const minimumMajor = 22;
const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

if (!Number.isFinite(major) || major < minimumMajor) {
  console.error(`Node.js ${minimumMajor}+ is required. Current version: ${process.versions.node}. Run "nvm use" before starting Hutka.`);
  process.exit(1);
}
