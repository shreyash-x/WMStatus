const config = require('config');
const { MongoClient, GridFSBucket } = require("mongodb");
const mongoose = require("mongoose");
const fs = require("fs");
const pathLib = require("path");
const mime = require("mime-types");
const mongoUrl = config.get('services.mongodb.uri');
const shell = require("shelljs");
const { getDownloaderInfo } = require("./trackServer.js");
const { sendMail } = require("./sendMail.js");


const getPath = () => {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0"); //January is 0
  const yyyy = String(date.getFullYear());
  const foldername = `${dd}${mm}${yyyy}`;
  const path = `${__dirname}/download-logs/${foldername}`;

  // check if logs directory exists
  if (!fs.existsSync(`${__dirname}/download-logs`)) {
    fs.mkdirSync(`${__dirname}/download-logs`);
  }

  return path;
}

const getLogStream = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
  const filename = fs.readdirSync(path).length + 1;
  const logStream = fs.createWriteStream(`${path}/${filename}.log`, { flags: "w" });
  return logStream;
};

const getUserLogs = (path) => {
  if(fs.existsSync(`${path}/stats.json`)) {
    return require(`${path}/stats.json`);
  }
  return {};
};

const formatLog = (log) => {
  const date = new Date();
  const time = date.toLocaleTimeString();
  return `[${time}]\t${log}`;
};

const path = getPath();
const logStream = getLogStream(path);
const userLogs = getUserLogs(path);

const writeLog = async (log) => {
  logStream.write(formatLog(log) + "\n");
};

const addUserStats = (username, stats) => {
  if (!userLogs[username]) {
    userLogs[username] = stats;
  }
  userLogs[username] = {
    new_downloaded: userLogs[username].new_downloaded + stats.new_downloaded,
    err_downloaded: userLogs[username].err_downloaded + stats.err_downloaded,
    already_downloaded:
      userLogs[username].already_downloaded + stats.already_downloaded,
  };
};

async function main() {
  const commands = [
    "mongoexport --collection=admins --db=whatsappLogs --out=admins.json",
    "mongoexport --collection=participants --db=whatsappLogs --out=participants.json",
    "mongoexport --collection=surveyors --db=whatsappLogs --out=surveyors.json",
  ];

  // make a directory to store the files ddmmyy
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0"); //January is 0!
  const yy =
    date.getFullYear().toString()[2] + date.getFullYear().toString()[3];
  const dir = `${__dirname}/../data/${dd}${mm}${yy}/`;

  // n days old dir to be deleted
  const old_date = new Date();
  old_date.setDate(old_date.getDate() - config.get('backup.duration'));
  const old_dd = String(old_date.getDate()).padStart(2, "0");
  const old_mm = String(old_date.getMonth() + 1).padStart(2, "0"); //January is 0!
  const old_yy =
    old_date.getFullYear().toString()[2] + old_date.getFullYear().toString()[3];
  const old_dir = `${__dirname}/../data/${old_dd}${old_mm}${old_yy}/`;


  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // export the data from the database
  writeLog("Exporting mongodb documents from the database");
  for (let command of commands) {
    const process = shell.exec(command, { silent: true, cwd: dir });
    logStream.write(formatLog(process.stderr));
  }
  if (fs.existsSync(old_dir)) {
    fs.rmdirSync(old_dir, { recursive: true });
  }
  writeLog("Exporting complete");

  const client = new MongoClient(mongoUrl, {
    useNewUrlParser: true,
  });

  try {
    await client.connect();
    const bucket = new GridFSBucket(client.db(), { bucketName: "largeFiles" });

    const contacts = await client
      .db()
      .collection("contacts")
      .find({})
      .toArray();
    for (const contact of contacts) {
      contact.contacts = await getJSONLog(bucket,contact.contacts.filename);
    }
    exportData(contacts, dir, "contacts.json");
    writeLog("Exported contact logs from database");

    const chatusers = await client
      .db()
      .collection("chatusers")
      .find({})
      .toArray();
    for (const chatuser of chatusers) {
      chatuser.chats = await getJSONLog(bucket,chatuser.chats.filename);
    }
    exportData(chatusers, dir, "chatusers.json");
    writeLog("Exported chatuser logs from database");
    // await listDatabases(client);
    // get all messages from the database
    const messages = await client
      .db()
      .collection("messages")
      .find({})
      .toArray();
    for (const message of messages) {
      let username = message.userName;
      writeLog(
        `Downloading files for ${username} for chat ${message.chatName}`
      );
      let new_downloaded = 0;
      let err_downloaded = 0;
      let already_downloaded = 0;
      // replace all the special characters with an underscore
      username = username.replace(/[^a-zA-Z0-9]/g, "_");
      const path = `${__dirname}/../downloaded-media/${username}-${message._id}/`;
      if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true });
      }
      message.messages = await getJSONLog(bucket, message.messages.filename);
      for (const msg of message.messages) {
        if (msg.hasMedia && msg.mediaData) {
          const fname = msg.mediaData.filename;
          const res = await downloadFile(fname, path, bucket, username);
          if (res == 0) {
            already_downloaded++;
          } else if (res == 1) {
            new_downloaded++;
          } else if (res == -1) {
            err_downloaded++;
          }
        }
      }
      writeLog(
        `Downloaded ${new_downloaded} new files, ${already_downloaded} already downloaded files, ${err_downloaded} errors encountered while downloading files`
      );
      addUserStats(username, {
        new_downloaded,
        err_downloaded,
        already_downloaded,
      });
    }
    exportData(messages, dir, "messages.json");
    writeLog("Exported message logs from database");
    fs.writeFileSync(`${path}/stats.json`, JSON.stringify(userLogs));
    // console.log("Connected correctly to server");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
    try {
      const html = await getDownloaderInfo(userLogs);
      writeLog("Updated website");
      if (config.get('mailer.enabled')) {
        try {
          await sendMail(html);
          writeLog("Mail sent successfully");
        } catch (err) {
          writeLog("Error sending mail");
        }
      }
    } catch (err) {
      writeLog("Error updating website");
      writeLog(err);
    }

  }
}

main().catch(console.error);

function extractFileFromDB(filename, bucket) {
  const downloadStream = bucket.openDownloadStreamByName(filename);

  // extract the file from the database along with its metadata
  const promise = new Promise((resolve, reject) => {
    const chunks = [];
    downloadStream.on("data", (chunk) => {
      chunks.push(chunk);
      // console.log("Downloading file...");
    });

    downloadStream.on("error", () => {
      reject();
    });

    downloadStream.on("end", () => {
      const file = Buffer.concat(chunks);
      resolve(file);
    });
  });
  return promise;
}

async function downloadFile(name, path, bucket, username) {
  try {
    const fileinfo = await bucket.find({ filename: name }).toArray();
    if (fileinfo.length === 0) {
      writeLog(`File ${name} not found in the database`);
      return -1;
    }
    const metadata = fileinfo[0].metadata;

    // Get the file extension by mime-type
    let extension = mime.extension(metadata.contentType);

    // Filename: change as you want!
    // I will use the time for this example
    // Why not use media.filename? Because the value is not certain exists
    let fname = "";
    if (metadata.originalfilename) {
      fname = metadata.originalfilename.split(".")[0];
      extension =
        metadata.originalfilename.split(".")[
        metadata.originalfilename.split(".").length - 1
        ];
    } else {
      fname = name;
    }

    const fullFilename = path + fname + "." + extension;
    // check if the file is already downloaded
    if (fs.existsSync(fullFilename)) {
      return 0;
    }

    const media = await extractFileFromDB(name, bucket);

    // Save to file
    try {
      // convert the file to base64
      const base64 = media.toString("base64");
      fs.writeFileSync(fullFilename, media, {
        encoding: "base64",
      });
      return 1;
      // console.log("File downloaded successfully!", fullFilename);
    } catch (err) {
      // console.log("Failed to save the file:", err);
      writeLog(`Failed to save the file: ${err}`);
      return -1;
    }
  } catch (err) {
    // console.log("Failed to download the file:", err);
    writeLog(`Failed to download the file: ${err}`);
    return -1;
  }
}

async function getJSONLog(bucket, filename) {

  const fileinfo = await bucket.find({ filename: filename }).toArray();
  if (fileinfo.length === 0) {
    console.log("File not found", filename);
    return;
  }
  const data = await extractFileFromDB(filename, bucket);
  const json = JSON.parse(data.toString());
  return json;
}

const exportData = async (dataArray, dir, fileName) => {
  const jsonLData = dataArray.map(obj => JSON.stringify(obj)).join('\n');
  fs.writeFileSync(pathLib.resolve(dir, fileName), jsonLData, 'utf8');
};
