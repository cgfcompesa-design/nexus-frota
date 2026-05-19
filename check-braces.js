import fs from "fs";

const content = fs.readFileSync("./src/components/telemetry/DriversRelation.tsx", "utf8");

// Simple regex to find XML/JSX tags (e.g. <Card> or </Card>, ignoring self-closing like <Input /> or <Mail />)
const tagRegex = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*(\/)?>|<\/([A-Za-z][A-Za-z0-9]*)>/g;

let stack = [];
let lines = content.split("\n");

console.log("Analyzing JSX tags...");

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  let match;
  // Use a regex exec loop for each line to track line numbers
  while ((match = tagRegex.exec(line)) !== null) {
    const full = match[0];
    const openTag = match[1];
    const isSelfClosing = match[2] === "/" || full.endsWith("/>");
    const closeTag = match[3];

    if (isSelfClosing) {
      // Ignore self-closing ones
      continue;
    }

    if (openTag) {
      // Don't trace lowercase standard simple tags if they are self-closing or handled, but let's trace everything to be robust
      stack.push({ tag: openTag, line: i + 1 });
    } else if (closeTag) {
      if (stack.length === 0) {
        console.log(`Error: Extra closing tag </${closeTag}> at line ${i + 1}`);
      } else {
        const last = stack.pop();
        if (last.tag !== closeTag) {
          console.log(`Mismatch: Opened <${last.tag}> at line ${last.line} but closed with </${closeTag}> at line ${i + 1}`);
        }
      }
    }
  }
}

console.log("Trace complete. Remaining open tags count:", stack.length);
if (stack.length > 0) {
  console.log("Unclosed tags:", stack);
}
