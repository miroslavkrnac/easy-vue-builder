const fs = require("fs");
const readline = require("readline");
const prependFile = require("prepend-file");
const npmRun = require("npm-run");
const git = require('simple-git/promise')
const bundleTextToAppend = "/*! no_asset_compression */\n"; 
let bundlePath = "app/assets/javascripts/easy_vue/bundle.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const getSetQuestion = (question) => new Promise(res => rl.question(question, res));

const getSetDefaultQuestion = (question, defaultValue) => new Promise(res => {
  rl.question(question, (newValue) => res(newValue.length ? newValue : defaultValue));
});

const finishAndExit = (branchName, commitName) => {
  console.log(
    `\n
     Successfully updated bundle.js \n
     Pushed to branch: ${branchName} \n
     Created commit: ${commitName} \n
     and pushed to branch
    `);
  process.exit(0);
};


const init = async () => {
  try {
    // ask if user pushed all files
    const pushedAndCommited = await getSetDefaultQuestion(`Have you committed and pushed all files? (yes): `, "yes");
    if (pushedAndCommited.toLowerCase() !== "yes") {
      throw new Error("Cancelled by user");
    }
    git().reset("hard");
    const {current: currentBranch} = await git().branch();
    // ask for branch name
    const branchName = await getSetDefaultQuestion(`Branch name: ${currentBranch} (yes): `, currentBranch);
    const commitMessage = await getSetDefaultQuestion("Commit name: new release (yes): ", "new release");   
    bundlePath = await getSetDefaultQuestion(`Bundle path ${bundlePath} (yes): `, bundlePath);
    // if users branch !== current branch, checkout to new specified branch
    if (branchName !== currentBranch) {
      await git().checkoutLocalBranch(branchName);
    }
    // Run npm build
    console.log("Started npm run build, please wait...");
    npmRun.execSync("npm run build");
    console.log("Successfully built bundle.js");
    const bundle = fs.existsSync(bundlePath);
    if (!bundle) {
      throw new Error("Bundle not found!!")
    }
    // append text to bundle.js
    prependFile.sync(bundlePath, bundleTextToAppend);
    // add all changes to git
    await git().add("*");
    // ask for commit message
    console.log("committed with message", commitMessage);
    await git().commit(commitMessage);
    await git().push("origin", branchName);
    finishAndExit(branchName, commitMessage);
  } catch(e) {
    console.log(e);
    process.exit(0);
  }
};

init();