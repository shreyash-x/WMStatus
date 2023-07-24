const shell = require("shelljs");
const fs = require("fs");
const { JSDOM } = require("jsdom");

const template = fs.readFileSync(`${__dirname}/template.html`, "utf8");
const dom = new JSDOM(template);
const { hostPages } = require("./renderPages.js");

const processNames = ["backend", "frontend"];

const getUptime = (upSince) => {
  // get current time in unix timestamp in milliseconds
  const now = new Date().getTime();
  // get uptime in seconds
  const uptime = Math.floor((now - upSince) / 1000);
  // convert uptime to days, hours, minutes and seconds
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);
  // return uptime in days, hours, minutes and seconds
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const convertToGB = (bytes) => {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2);
};
const getPM2Info = async () => {
  const pm2Info = shell.exec("pm2 jlist", { silent: true });
  const json_data = JSON.parse(pm2Info.stdout);
  return json_data;
};

const processPM2Info = async () => {
  const pm2Info = await getPM2Info();
  const processedData = {};
  for (let process of pm2Info) {
    const name = process.name;
    if (!processNames.includes(name)) {
      continue;
    }
    processedData[name] = {
      restarts: process.pm2_env.restart_time,
      uptime: getUptime(process.pm2_env.pm_uptime),
      status: process.pm2_env.status,
      memory: convertToGB(process.monit.memory),
      cpu: process.monit.cpu,
    };
  }
  return processedData;
};

const generateTablePM2 = async () => {
  const pm2Info = await processPM2Info();
  for (let key in pm2Info) {
    const row = dom.window.document.createElement("tr");
    const name = dom.window.document.createElement("td");
    name.textContent = key;
    const restarts = dom.window.document.createElement("td");
    restarts.textContent = pm2Info[key].restarts;
    const uptime = dom.window.document.createElement("td");
    uptime.textContent = pm2Info[key].uptime;
    const status = dom.window.document.createElement("td");
    status.textContent = pm2Info[key].status;
    const memory = dom.window.document.createElement("td");
    memory.textContent = pm2Info[key].memory + "GB";
    const cpu = dom.window.document.createElement("td");
    cpu.textContent = pm2Info[key].cpu + "%";
    row.appendChild(name);
    row.appendChild(restarts);
    row.appendChild(uptime);
    row.appendChild(status);
    row.appendChild(memory);
    row.appendChild(cpu);
    dom.window.document.getElementById("serverStats").appendChild(row);
  }
};

const getDownloaderInfo = async (userStats) => {
  for (let key in userStats) {
    const row = dom.window.document.createElement("tr");
    const username = dom.window.document.createElement("td");
    username.textContent = key;
    const new_downloaded = dom.window.document.createElement("td");
    new_downloaded.textContent = userStats[key].new_downloaded;
    const err_downloaded = dom.window.document.createElement("td");
    err_downloaded.textContent = userStats[key].err_downloaded;
    const already_downloaded = dom.window.document.createElement("td");
    already_downloaded.textContent = userStats[key].already_downloaded;

    row.appendChild(username);
    row.appendChild(new_downloaded);
    row.appendChild(err_downloaded);
    row.appendChild(already_downloaded);
    dom.window.document.getElementById("downloaderStats").appendChild(row);
  }

  await generateTablePM2();
  const html = dom.serialize();

  // write html to file
  const date = new Date();
  let dd = String(date.getDate()).padStart(2, "0");
  let mm = String(date.getMonth() + 1).padStart(2, "0"); //January is 0!
  let yyyy = date.getFullYear();
  const fname = `${__dirname}/pages/${dd}-${mm}-${yyyy}.html`;
  fs.writeFileSync(fname, html);
  await hostPages();
  return html;
};

module.exports = {
  getDownloaderInfo,
};
