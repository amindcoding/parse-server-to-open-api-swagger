const mapParseTypeToOpenAPI = (parseType) => {
  const mapping = {
    String: { type: "string" },
    Number: { type: "number" },
    Boolean: { type: "boolean" },
    Date: { type: "string", format: "date-time" },
    Object: { type: "object" },
    Array: { type: "array", items: { type: "string" } },
    File: { type: "string", format: "binary" },
    Pointer: { type: "string", description: "Pointer ID" },
    Relation: { type: "array", items: { type: "object" } },
  };
  return mapping[parseType] || { type: "string" };
};
