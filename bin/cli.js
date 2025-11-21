#!/usr/bin/env node

const { Command } = require('commander');
const SwaggerGenerator = require('../src/generator');
require('dotenv').config(); // Load env dari project user di mana command dijalankan

const program = new Command();

program
  .name('parse-swagger')
  .description('CLI to generate OpenAPI definitions from Parse Server')
  .version('1.0.0')
  .option('--app-id <string>', 'Parse Application ID (default: process.env.APP_ID)')
  .option('--master-key <string>', 'Parse Master Key (default: process.env.MASTER_KEY)')
  .option('--server-url <string>', 'Parse Server URL (default: process.env.SERVER_URL)')
  .option('--output <path>', 'Output file path', './swagger.yaml')
  .option('--title <string>', 'API Title in Swagger', 'Parse Server API')
  .option('--exclude-system', 'Exclude default Parse classes (like _Session, _Role)', false)
  .action(async (options) => {
    
    // Prioritas: Flag CLI > Environment Variables
    const config = {
        appId: options.appId || process.env.APP_ID,
        masterKey: options.masterKey || process.env.MASTER_KEY,
        serverUrl: options.serverUrl || process.env.SERVER_URL,
        outputPath: options.output,
        apiTitle: options.title,
        excludeSystemClasses: options.excludeSystem
    };

    try {
        const generator = new SwaggerGenerator(config);
        await generator.generate();
    } catch (error) {
        console.error("\n⚠️  Failed to generate documentation.");
        console.error("Please ensure you provided APP_ID, MASTER_KEY, and SERVER_URL either via .env or CLI flags.\n");
        process.exit(1);
    }
  });

program.parse(process.argv);