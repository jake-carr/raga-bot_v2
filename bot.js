require("dotenv").config();
const ytdl = require("ytdl-core");

const Discord = require("discord.js");
const token = process.env.TOKEN;

const ragas = require("./constants/ragas");
const prefix = "!";

const listRagNames = () => {
  const names = [];
  for (let raga of ragas) {
    names.push(raga.name);
  }
  return names
}

const getRagaUrl = (name) => {
  for (let raga of ragas) {
    if (raga.name == name) return raga.url
  }
};

const ragaMenu = () => {
  const ragaList = new Discord.MessageEmbed()
    .setColor("#0099ff")
    .setTitle("Raga Menu");

  for (let raga of ragas) {
    ragaList.addFields({
      name: `Raag ${raga.name}`,
      value: raga.artist
    })
  };

  return ragaList;
};

const help = () => {
  const helpMsg = new Discord.MessageEmbed()
    .setColor("#0099ff")
    .setTitle("Commands")
    .addFields(
      { name: "!ragas", value: "List of ragas & their artists" },
      { name: "!dm <raga>", value: "DM's a raga url for your 2nd monitor" },
      {
        name: "!rag or !play <raga>",
        value:
          "Play (or queue up) a Classic Hindustani Performance in the voice channel",
      },
      {
        name: "!rag or !play <youtube url>",
        value:
          "Use same commands to play/queue other music in the voice channel",
      },
      {
        name: "!skip",
        value: "if current song is :man_gesturing_no:",
        inline: true,
      },
      { name: "!stop", value: ":hand_splayed: :stop_sign:", inline: true }
  );

  return helpMsg;
};

// --Commands--
// !help
// !ragas
// !rag or !play <raga> or <youtube url>
// !dm <raga>

const client = new Discord.Client();
const queue = new Map();

client.on("message", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);
  const args = message.content.split(" ");
  // args[0] = !<command>, args[1] = raga name

  if (message.content.startsWith(`${prefix}help`)) {
    message.channel.send(help());
  } else if (message.content.startsWith(`${prefix}dm`)) {
    const user = client.users.cache.get(message.author.id);
    const content = getRagaUrl(args[1]);
    if (content == undefined) {
      return;
    } else {
      user.send(content);
    }
  } else if (message.content.startsWith(`${prefix}ragas`)) {
    message.channel.send(ragaMenu());
  } else if (message.content.startsWith(`${prefix}rag`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)) {
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)) {
    stop(message, serverQueue);
    return;
  } else {
    message.channel.send("do you need !help?");
  }
});

async function execute(message, serverQueue) {
  const args = message.content.split(" ");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "you need to be in a voice channel to play music"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "i need permission to join and speak in your voice channel"
    );
  }

  let song;
  const raags = listRagNames();

  // if user is specifying a listed raga, play that, otherwise play the linked url
  if (raags.includes(args[1])) {
    song = {
      title: args[1],
      url: getRagaUrl(args[1]),
    };
  } else {
    const songInfo = await ytdl.getInfo(args[1]);
    song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
    };
  }

  if (!serverQueue) {
    const queueConstructor = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true,
    };

    queue.set(message.guild.id, queueConstructor);
    queueConstructor.songs.push(song);

    try {
      var connection = await voiceChannel.join();
      queueConstructor.connection = connection;
      play(message.guild, queueConstructor.songs[0]);
    } catch (err) {
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);
    return message.channel.send(`added ${song.title} to queue`);
  }
}

// start calling people bozos when they misuse bot commands too much. resets to 0 when commands are used right
let bozoCounter = 0;

function skip(message, serverQueue) {
  if (!message.member.voice.channel)
    bozoCounter++;
    return message.channel.send(
      `you have to be in the voice channel to have any input about the music ${bozoCounter >= 5 ? ', bozo!' : '!'}`
    );
  if (!serverQueue) return message.channel.send("NOTHING TO SKIP");
  bozoCounter = 0;
  serverQueue.connection.dispatcher.end();
}

function stop(message, serverQueue) {
  if (!message.member.voice.channel)
    bozoCounter++;
    return message.channel.send(
      `you have to be in the voice channel to have any input about the music ${bozoCounter >= 5 ? ', bozo!' : '!'}`
    );
  serverQueue.songs = [];
  bozoCounter = 0;
  serverQueue.connection.dispatcher.end();
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }
  const dispatcher = serverQueue.connection
    .play(ytdl(song.url))
    .on("finish", () => {
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on("error", (error) => console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
  serverQueue.textChannel.send(`playing **${song.title}**`);
  bozoCounter = 0;
}

client.login(token);
