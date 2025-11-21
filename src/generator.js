const Parse = require("parse/node");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");

class SwaggerGenerator {
  constructor(config) {
    if (!config.appId || !config.masterKey || !config.serverUrl) {
      throw new Error(
        "Missing required Parse configuration: appId, masterKey, or serverUrl."
      );
    }

    this.config = config;
    this.outputPath = config.outputPath || "./parse-swagger.yaml";

    Parse.initialize(config.appId, null, config.masterKey);
    Parse.serverURL = config.serverUrl;
  }

  mapParseTypeToOpenAPI(fieldData) {
    const type = fieldData.type;
    const targetClass = fieldData?.targetClass || undefined; // Untuk Pointer/Relation

    let schema = {};

    switch (type) {
      case "String":
        schema = { type: "string" };
        break;
      case "Number":
        schema = { type: "number" };
        break;
      case "Boolean":
        schema = { type: "boolean" };
        break;
      case "Date":
        schema = { type: "string", format: "date-time" };
        break;
      case "Object":
        schema = { type: "object", additionalProperties: true }; // Allow free-form object
        break;
      case "Array":
        schema = { type: "array", items: { type: "string" } }; // Generic array
        break;
      case "GeoPoint":
        schema = { $ref: "#/components/schemas/ParseGeoPoint" };
        break;
      case "File":
        schema = { type: "string", format: "binary" };
        break;
      case "Pointer":
        // Pointer adalah object khusus di Parse REST
        schema = {
          $ref: "#/components/schemas/ParsePointer",
          description: targetClass
            ? `Pointer to Class: ${targetClass}`
            : "Pointer",
        };
        break;
      case "Relation":
        schema = {
          type: "object",
          description: targetClass
            ? `Relation to Class: ${targetClass}`
            : "Relation",
          properties: {
            __type: { type: "string", example: "Relation" },
            className: { type: "string", example: targetClass },
          },
        };
        break;
      default:
        schema = { type: "string" };
    }

    return schema;
  }

  getStandardQueryParams() {
    return [
      {
        name: "where",
        in: "query",
        schema: { type: "string" },
        description: `JSON encoded query constraints (e.g. {"score":{"$gt":10}}). Supports Basic Queries, Constraints, Relational Queries.`,
      },
      {
        name: "limit",
        in: "query",
        schema: { type: "integer", default: 100 },
        description: "Limit the number of objects returned",
      },
      {
        name: "skip",
        in: "query",
        schema: { type: "integer", default: 0 },
        description: "Skip the number of objects",
      },
      {
        name: "order",
        in: "query",
        schema: { type: "string" },
        description: 'Sort field (e.g. "score" or "-score" for descending)',
      },
      {
        name: "keys",
        in: "query",
        schema: { type: "string" },
        description: "Restrict fields to return (comma separated)",
      },
      {
        name: "include",
        in: "query",
        schema: { type: "string" },
        description: 'Expand Pointers (e.g. "post.author")',
      },
      {
        name: "count",
        in: "query",
        schema: { type: "integer", enum: [1] },
        description: "Return the count of objects (set to 1)",
      },
      {
        name: "distinct",
        in: "query",
        schema: { type: "string" },
        description: "Return distinct values for a specific field",
      },
    ];
  }

  async generate() {
    console.log(`🔍 Connecting to Parse Server at ${this.config.serverUrl}...`);

    try {
      const schemas = await Parse.Schema.all();

      const swaggerDoc = {
        openapi: "3.0.0",
        info: {
          title: this.config.apiTitle || "Parse Server REST API",
          version: "1.0.0",
          description:
            "Generated automatically. Supports Parse REST API Query Constraints.",
        },
        servers: [{ url: this.config.serverUrl }],
        components: {
          securitySchemes: {
            AppId: {
              type: "apiKey",
              in: "header",
              name: "X-Parse-Application-Id",
            },
            SessionToken: {
              type: "apiKey",
              in: "header",
              name: "X-Parse-Session-Token",
            },
            MasterKey: {
              type: "apiKey",
              in: "header",
              name: "X-Parse-Master-Key",
            },
          },
          schemas: {
            ParsePointer: {
              type: "object",
              properties: {
                __type: { type: "string", example: "Pointer" },
                className: { type: "string" },
                objectId: { type: "string" },
              },
              required: ["__type", "className", "objectId"],
            },
            ParseGeoPoint: {
              type: "object",
              properties: {
                __type: { type: "string", example: "GeoPoint" },
                latitude: { type: "number" },
                longitude: { type: "number" },
              },
            },
            ParseError: {
              type: "object",
              properties: {
                code: { type: "integer" },
                error: { type: "string" },
              },
            },
          },
        },
        security: [{ AppId: [] }],
        paths: {},
      };

      schemas.forEach((schema) => {
        const className = schema.className;
        if (
          this.config.excludeSystemClasses &&
          className.startsWith("_") &&
          className !== "_User"
        )
          return;

        const properties = {
          objectId: { type: "string", description: "Unique identifier" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          ACL: { type: "object", description: "Access Control List" },
        };

        const requiredFields = [];

        const rawFields = schema.fields || {};
        Object.keys(rawFields).forEach((fieldName) => {
          const fieldData = rawFields[fieldName];

          if (!properties[fieldName]) {
            properties[fieldName] = this.mapParseTypeToOpenAPI(fieldData);
          }

          if (fieldData.required) {
            requiredFields.push(fieldName);
          }
        });

        swaggerDoc.components.schemas[className] = {
          type: "object",
          required: requiredFields.length > 0 ? requiredFields : undefined,
          properties: properties,
        };

        const basePath = `/classes/${className}`;
        const objectPath = `/classes/${className}/{objectId}`;

        swaggerDoc.paths[basePath] = {
          get: {
            tags: [className],
            summary: `Query ${className}`,
            description:
              'Retrieves objects matching the query criteria. Supports complex queries via "where" parameter.',
            parameters: this.getStandardQueryParams(className),
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        results: {
                          type: "array",
                          items: { $ref: `#/components/schemas/${className}` },
                        },
                        count: {
                          type: "integer",
                          description: "Present if count=1 is passed",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            tags: [className],
            summary: `Create ${className}`,
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: `#/components/schemas/${className}` },
                },
              },
            },
            responses: {
              201: {
                description: "Created",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        objectId: { type: "string" },
                        createdAt: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        };

        swaggerDoc.paths[objectPath] = {
          get: {
            tags: [className],
            summary: `Get ${className} by ID`,
            parameters: [
              {
                name: "objectId",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              200: {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: `#/components/schemas/${className}` },
                  },
                },
              },
            },
          },
          put: {
            tags: [className],
            summary: `Update ${className}`,
            parameters: [
              {
                name: "objectId",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: `#/components/schemas/${className}` },
                },
              },
            },
            responses: {
              200: {
                description: "Updated",
                content: {
                  "application/json": {
                    schema: { properties: { updatedAt: { type: "string" } } },
                  },
                },
              },
            },
          },
          delete: {
            tags: [className],
            summary: `Delete ${className}`,
            parameters: [
              {
                name: "objectId",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: { 200: { description: "Deleted" } },
          },
        };
      });

      const yamlStr = yaml.dump(swaggerDoc);
      const dir = path.dirname(this.outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.outputPath, yamlStr, "utf8");
      console.log(`✅ Advanced Swagger generated at: ${this.outputPath}`);
    } catch (error) {
      console.error("❌ Error:", error);
    }
  }
}

module.exports = SwaggerGenerator;
