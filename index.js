const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior
} = require('@discordjs/voice');

const play = require('play-dl');
const { getData } = require('spotify-url-info')(require('node-fetch'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const CANAL_BOT = '1516850179322413238';

// 🎵 SERVIDORES
const servers = new Map();

function getServer(guildId) {
    if (!servers.has(guildId)) {
        servers.set(guildId, {
            connection: null,
            player: createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play
                }
            }),
            songs: [],
            current: null,
            paused: false
        });
    }
    return servers.get(guildId);
}

// ▶️ READY
client.once('ready', () => {
    console.log(`🎶 Bot listo como ${client.user.tag}`);
});

// 💬 MESSAGE HANDLER
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== CANAL_BOT) return;

    const args = message.content.trim().split(' ');
    const command = args[0].toLowerCase();
    const server = getServer(message.guild.id);

    if (command === 'play') {
        const query = args.slice(1).join(' ');
        if (!query) return message.reply('❌ Escribe una canción');

        const voice = message.member.voice.channel;
        if (!voice) return message.reply('❌ Entra a un canal de voz');

        let searchQueries = [];

        if (query.includes('spotify.com')) {
            const data = await getData(query);

            if (data.type === 'track') {
                searchQueries = [`${data.name} ${data.artists[0].name}`];
            } else if (data.type === 'playlist') {
                searchQueries = data.tracks.items.map(
                    t => `${t.track.name} ${t.track.artists[0].name}`
                );
            }
        } else {
            searchQueries = [query];
        }

        for (const q of searchQueries) {
            const results = await play.search(q, { limit: 1 });

            if (results.length) {
                server.songs.push({
                    title: results[0].title,
                    url: results[0].url
                });
            }
        }

        if (!server.connection) {
            server.connection = joinVoiceChannel({
                channelId: voice.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            });

            server.connection.subscribe(server.player);

            server.player.on(AudioPlayerStatus.Idle, () => {
                server.songs.shift();
                playSong(message.guild);
            });

            playSong(message.guild);
        }

        return message.reply(`🎵 Añadido a la cola`);
    }

    if (command === 'stop') {
        server.songs = [];
        server.connection?.destroy();
        server.connection = null;
        return message.reply('⏹ Detenido');
    }

    if (command === 'pause') {
        server.player.pause();
        return message.reply('⏸ Pausado');
    }

    if (command === 'resume') {
        server.player.unpause();
        return message.reply('▶️ Reanudado');
    }

    if (command === 'ver') {
        return message.reply(
            server.songs.length
                ? server.songs.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
                : '📭 Cola vacía'
        );
    }

    if (command === 'now') {
        return message.reply(
            server.current ? `🎶 Ahora suena: **${server.current.title}**` : '❌ Nada reproduciéndose'
        );
    }
});

// ▶️ PLAY FUNCTION
async function playSong(guild) {
    const server = getServer(guild.id);

    if (!server.songs.length) {
        server.current = null;
        return;
    }

    const song = server.songs[0];
    server.current = song;

    try {
        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type
        });

        server.player.play(resource);
    } catch (err) {
        console.log(err);
        server.songs.shift();
        playSong(guild);
    }
}

// 🔐 TOKEN DESDE RAILWAY
client.login(process.env.TOKEN);