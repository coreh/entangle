const { rgPath } = require('vscode-ripgrep');
const child_process = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const util = require('util');
const stat = util.promisify(fs.stat);
const rename = util.promisify(fs.rename);
const watch = require('node-watch');

const METASYNTACTIC_VARIABLES = ['💫', '🚧', '🔨'];
const OPEN_REGEXP = new RegExp(`(\\s*).+(${METASYNTACTIC_VARIABLES.join('|')})\\s+([a-zA-Z0-9:\\-\\/]+)`);
const CLOSE_REGEXP = new RegExp(`(${METASYNTACTIC_VARIABLES.join('|')})(\\s+[^a-zA-Z0-9:\\-\\/]|\\S|$)`);
const SWAP_FILE_EXTENSION = '.entangle.swp';

exports.Entangle = class Entangle {
    constructor(path) {
        this.path = path;
    }

    async run() {

        this.start = Date.now();

        await this.findFilenames();
        await this.readHunks();
        await this.writeHunks();
        await this.swapFiles();

        this.end = Date.now();

        this.logInfo();
    }

    async watch() {
        await this.run();

        let running = false;

        watch(this.path, { recursive: true, delay: 200 }, (evt, name) => {
            if (running) {
                return;
            }

            running = true;

            this.run().then(() => {
                setTimeout(() => {
                    running = false;
                }, 200);
            });
        });
    }

    async findFilenames() {
        return new Promise((resolve, reject) => {

            const proc = child_process.spawn(rgPath, ['--files-with-matches', OPEN_REGEXP.source.replace('\\/', '/'), this.path]);

            this.filenames = [];

            readline.createInterface({
                input: proc.stdout,
                terminal: false,
            }).on('line', filename => {
                this.filenames.push(filename);
            })

            proc.on('close', code => {
                this.filenames.sort();
                resolve();
            })

            proc.on('error', reject);
        });
    }

    async readHunks() {
        this.hunks = {};

        for (const filename of this.filenames) {
            await this.readHunksFromFile(filename);
        }
    }

    async readHunksFromFile(filename) {
        const { mtime } = await stat(filename);

        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filename);
            let hunk = null;
            let indent = '';

            readline.createInterface({
                input: stream,
            }).on('line', line => {
                const open = OPEN_REGEXP.exec(line);
                const close = CLOSE_REGEXP.exec(line);

                if (open) {
                    hunk = {
                        type: open[2],
                        name: open[3],
                        mtime: mtime,
                        lines: [],
                    }

                    indent = open[1];
                }

                if (hunk) {
                    hunk.lines.push(line.replace(new RegExp(`^${indent}`), ''));
                }

                if (close) {
                    this.storeHunk(hunk);

                    hunk = null;
                }
            });

            stream.on('close', code => {
                resolve();
            });

            stream.on('error', reject);
        });
    }

    storeHunk(hunk) {
        const existingHunk = this.hunks[hunk.name];
        if (hunk.type === '💫' && (!existingHunk || existingHunk.type === '💫' && existingHunk.mtime < hunk.mtime)) {
            this.hunks[hunk.name] = hunk;
        } else if (hunk.type === '🚧' && !existingHunk) {
            hunk.lines.splice(1, hunk.lines.length - 2);
            this.hunks[hunk.name] = hunk;
        } else if (hunk.type === '🔨') {
            hunk.type = '🚧';
            hunk.lines[0] = hunk.lines[0].replace('🔨', '🚧');
            hunk.lines[hunk.lines.length - 1] = hunk.lines[hunk.lines.length - 1].replace('🔨', '🚧');
            if (!existingHunk) {
                this.hunks[hunk.name] = hunk;
            } else if (existingHunk.type === '🚧') {
                hunk.lines.splice(1, 0, ...existingHunk.lines.slice(1, -1));
                this.hunks[hunk.name] = hunk;
            }
        }
    }

    async writeHunks() {
        for (const filename of this.filenames) {
            await this.writeHunksToFile(filename);
        }
    }

    async writeHunksToFile(filename) {
        return new Promise((resolve, reject) => {
            const inStream = fs.createReadStream(filename);
            const outStream = fs.createWriteStream(filename + SWAP_FILE_EXTENSION);

            let hunk = null;
            let indent = '';
            let backLines = [];

            readline.createInterface({
                input: inStream,
            }).on('line', line => {
                const open = OPEN_REGEXP.exec(line);
                const close = CLOSE_REGEXP.exec(line);

                if (open && this.hunks[open[3]] && open[2] === this.hunks[open[3]].type) {
                    indent = open[1];

                    if (hunk) {
                        for (const backLine of backLines) {
                            outStream.write(`${backLine}\n`);
                        }
                        backLines = [];
                    }

                    hunk = this.hunks[open[3]];
                    backLines.push(line);

                    if (!hunk) {
                        throw new Error(`Unable to find hunk named ${open[3]}`);
                    }
                } else {
                    if (!hunk) {
                        outStream.write(line + '\n');
                    } else {
                        backLines.push(line);
                    }

                    if (close) {
                        if (hunk) {
                            for (const hunkLine of hunk.lines) {
                                outStream.write(`${(indent+hunkLine).replace(/\s+$/, '')}\n`);
                            }
                            backLines = [];
                            hunk = null;
                        }
                    }
                }
            });

            inStream.on('close', () => {
                outStream.end();
            });

            outStream.on('close', () => {
                resolve();
            });

            inStream.on('error', reject);
            outStream.on('error', reject);
        });
    }

    async swapFiles() {
        for (const filename of this.filenames) {
            await rename(filename + SWAP_FILE_EXTENSION, filename);
        }
    }

    logInfo() {
        console.log('Synced %i hunks across %i files in %i ms', Object.keys(this.hunks).length, this.filenames.length, this.end - this.start);
    }
}
