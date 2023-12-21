import fs from 'fs/promises';
import path from 'path';

type NestedObject = {
  [key: string]: any;
};

export async function openConfigFiles(pathToConfig: string) {
  const filePathConfig = path.join(pathToConfig, 'config.json');
  const fileContentsConfig = await fs.readFile(filePathConfig, 'utf8');
  const config = JSON.parse(fileContentsConfig);
  const filePathFolder = path.join(pathToConfig, 'FOLDER.json');
  const fileContentsFolder = await fs.readFile(filePathFolder, 'utf8');
  const folder = JSON.parse(fileContentsFolder);
  const filePathJob = path.join(pathToConfig, 'JOB.json');
  const fileContentsJob = await fs.readFile(filePathJob, 'utf8');
  const job = JSON.parse(fileContentsJob);
  const filePathOn = path.join(pathToConfig, 'ON.json');
  const fileContentsOn = await fs.readFile(filePathOn, 'utf8');
  const on = JSON.parse(fileContentsOn);
  const filePathQuantitative = path.join(pathToConfig, 'QUANTITATIVE.json');
  const fileContentsQuantitative = await fs.readFile(filePathQuantitative, 'utf8');
  const quantitative = JSON.parse(fileContentsQuantitative);
  const filePathVariable = path.join(pathToConfig, 'VARIABLE.json');
  const fileContentsVariable = await fs.readFile(filePathVariable, 'utf8');
  const variable = JSON.parse(fileContentsVariable);
  assignAttributes(config, 'FOLDER', folder);
  assignAttributes(config, 'JOB', job);
  assignAttributes(config, 'ON', on);
  assignAttributes(config, 'QUANTITATIVE', quantitative);
  assignAttributes(config, 'VARIABLE', variable);
  return config;
}

function assignAttributes(obj: NestedObject, keyToInsert: string, insertJsonConfig: NestedObject | NestedObject[]) {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (key === keyToInsert) {
          // Check if insertJsonConfig is an array
          if (Array.isArray(insertJsonConfig)) {
            // If it is, assign it directly
            obj[key] = insertJsonConfig;
          } else {
            // If it's not, merge it into the existing object
            obj[key] = { ...obj[key], ...insertJsonConfig };
          }
        } else {
          // Recursively call for nested objects
          assignAttributes(obj[key], keyToInsert, insertJsonConfig);
        }
      }
    }
  }
}

// function assignAttributes(obj: NestedObject, keyToInsert: string, insertJsonConfig: NestedObject) {
//   for (const key in obj) {
//     if (obj.hasOwnProperty(key)) {
//       if (typeof obj[key] === 'object' && obj[key] !== null) {
//         if (key === keyToInsert) {
//           // Merge the insertJsonConfig into the existing object
//           obj[key] = { ...obj[key], ...insertJsonConfig };
//         } else {
//           // Recursively call for nested objects
//           assignAttributes(obj[key], keyToInsert, insertJsonConfig);
//         }
//       }
//     }
//   }
// }

function formatXml(xml: string): string {
  let formatted = '';
  let indent = '';
  const tab = '  '; // Define tab as two spaces for indentation

  xml.split(/>\s*</).forEach((element) => {
    if (element.match(/^\/\w/)) {
      indent = indent.substring(tab.length); // Decrease indentation
    }

    formatted += indent + '<' + element + '>\r\n';

    if (element.match(/^<?\w[^>]*[^/]$/)) {
      indent += tab; // Increase indentation
    }
  });

  return formatted.substring(1, formatted.length - 3);
}

export async function writeFileTest(content: string, pathToConfig: string) {
  const filePathFolder = path.join(pathToConfig, 'output.xml');
  console.log(filePathFolder);
  try {
    await fs.writeFile(filePathFolder, content);
  } catch (err) {
    console.log(err);
  }
}
