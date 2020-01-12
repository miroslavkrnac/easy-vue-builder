const fs = require("fs");
const prependFile = require("prepend-file");
const npmRun = require("npm-run");
const git = require("simple-git/promise");
const bundleTextToAppend = "/*! no_asset_compression */\n";
const exec = require("child_process");
let bundlePath = "app/assets/javascripts/easy_vue/bundle.js";
const versionPath = "lib/easy_vue/version.rb";
const prompts = require("prompts");

const getCurrentVersion = () => {
  const isVersion = fs.existsSync(versionPath);
  if (!isVersion) return null;
  const version = fs.readFileSync(versionPath, "utf8");
  const versionParsedArr = version.match(/(\d+).(\d+).(\d+)/);

  const [versionString, major, minor, patch] = versionParsedArr;
  return {
    versionString,
    major,
    minor,
    patch
  };
};

const resetAndCommit = async ({ value: confirmed, aborted }) => {
  if (!confirmed || aborted) {
    console.log("\n You have to push and commit all data first");
    process.exit(0);
  }
  git().reset("hard");
};

const getIncreasedVersion = (computedVersions, versionType) => {
  const attrName = `increased${versionType
    .charAt(0)
    .toUpperCase()}${versionType.slice(1)}`;
  return computedVersions[attrName];
};

const getBranchChoices = async (options, versionType) => {
  const { currentBranch, computedVersions } = options;
  const choices = [
    { title: `${currentBranch}`, value: `${currentBranch}` },
    { title: `Own name`, value: "own" }
  ];
  if (versionType) {
    const increasedVersion = getIncreasedVersion(computedVersions, versionType);
    choices.unshift({
      title: `release_${increasedVersion}`,
      value: `release_${increasedVersion}`
    });
  }
  return choices;
};

const processResponses = async (answers, computedVersions) => {
  const { bundlePath, commitMessage, branchName, versionType } = answers;
  const { current: currentBranch } = await git().branch();

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
    console.log("Bundle not found!!");
    process.exit(0);
  }
  // append text to bundle.js
  prependFile.sync(bundlePath, bundleTextToAppend);

  // modify version.rb if version change is chosen
  if (versionType) {
    const versionFile = fs.readFileSync(versionPath, "utf8");
    const versionRegxp = /(\d+).(\d+).(\d+)/;
    const increasedVersion = getIncreasedVersion(computedVersions, versionType);
    const newVersionFile = versionFile.replace(versionRegxp, increasedVersion);
    fs.writeFileSync(versionPath, newVersionFile, "utf8");
    console.log("Sjccessfully changed version in version.rb");
  }

  // add all changes to git
  await git().add("*");
  await git().commit(commitMessage);
  console.log("Committed with message: ", commitMessage);
  await git().push("origin", branchName);
  console.log("Pushed to branch: ", branchName);
  console.log("Finished!");
};

const computeVersions = currVersion => {
  const { major, minor, patch } = currVersion;
  const increasedMajor = `${+major + 1}.${minor}.${patch}`;
  const increasedMinor = `${major}.${+minor + 1}.${patch}`;
  const increasedPatch = `${major}.${minor}.${+patch + 1}`;
  return {
    increasedMajor,
    increasedMinor,
    increasedPatch
  };
};

const init = async () => {
  const currVersion = getCurrentVersion();
  const { current: currentBranch } = await git().branch();

  const computedVersions = computeVersions(currVersion);
  const { increasedMajor, increasedMinor, increasedPatch } = computedVersions;
  const answers = await prompts([
    {
      type: "confirm",
      name: "pushedAndCommited",
      message: "Have you commited and pushed all files?",
      initial: true,
      onState: resetAndCommit
    },
    {
      type: "select",
      name: "versionType",
      message: `Pick a version you want to increase. Current version is: ${currVersion.versionString}`,
      choices: [
        { title: `Patch (version will be: ${increasedPatch})`, value: "patch" },
        { title: `Minor (version will be: ${increasedMinor})`, value: "minor" },
        { title: `Major (version will be: ${increasedMajor})`, value: "major" },
        { title: `None of them`, value: null }
      ]
    },
    {
      type: "select",
      name: "branchName",
      message: `Select branch name`,
      choices: getBranchChoices.bind(null, {
        currentBranch,
        computedVersions
      })
    },
    {
      type: prev => (prev === "own" ? "text" : false),
      name: "branchName",
      message: `Type branch name`
    },
    {
      type: "text",
      name: "commitMessage",
      message: `Commit message`,
      initial: prev => `New ${prev}`
    },
    {
      type: "text",
      name: "bundlePath",
      message: `Bundle path`,
      initial: `${bundlePath}`
    }
  ]);

  await processResponses(answers, computedVersions);
};

init();
