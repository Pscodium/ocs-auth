import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

function walkDir(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith(".js")) {
      let content = readFileSync(fullPath, "utf-8");
      
      // Add .js to all relative imports that don't already have extensions
      content = content.replace(
        /from\s+["']([\.][\.\/][^"']+?)(?<!\.js)["']/g,
        'from "$1.js"'
      );
      
      writeFileSync(fullPath, content);
    }
  }
}

walkDir("dist");
console.log("✓ Added .js extensions to imports");
