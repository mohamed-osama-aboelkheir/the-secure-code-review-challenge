const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * Pandoc resolves resources referenced by a document while converting it: an
 * image URL is fetched over the network, a local path is read off disk, and
 * raw TeX in a Markdown source is handed to the PDF engine, which can \input
 * further files. Uploaded documents are untrusted, so conversion runs with
 * those capabilities switched off:
 *
 *   --sandbox  limits reader/writer IO to the files named on the command line
 *   -f <fmt>   pins the reader to the declared input type, with raw TeX
 *              disabled for Markdown so nothing reaches the PDF engine
 */

const READER_BY_EXTENSION = {
  '.md': 'markdown-raw_tex',
  '.docx': 'docx'
};

/**
 * Runs pandoc to convert the input file to the output path.
 */
async function convertFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = ['--sandbox'];

    const reader = READER_BY_EXTENSION[path.extname(inputPath).toLowerCase()];
    if (reader) {
      args.push('-f', reader);
    }

    args.push(inputPath, '-o', outputPath);

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
