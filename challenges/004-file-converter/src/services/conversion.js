const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Runs pandoc to convert the input file to the output path.
 */
async function convertFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [inputPath, '-o', outputPath];

    execFile('pandoc', args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Pandoc error:', error);
        console.error('Stderr:', stderr);
        return reject(new Error(`Conversion failed: ${stderr || error.message}`));
      }

      fs.access(outputPath)
        .then(() => resolve(outputPath))
        .catch(() => reject(new Error('Output file was not created')));
    });
  });
}

module.exports = {
  convertFile
};
