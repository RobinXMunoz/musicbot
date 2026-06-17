const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior
} = require('@discordjs/voice');

const play = require('play-dl');
const { getData } = require('spotify-url-info')(fetch);

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

// 🎧 SPOTIFY RESOLVER
async function resolveSpotify(url) {
    const data = await getData(url);

    // 🎵 TRACK
    if (data.type === 'track') {
        return [`${data.name} ${data.artists[0].name}`];
    }

    // 📜 PLAYLIST
    if (data.type === 'playlist') {
        return data.tracks.items.map(
            t => `${t.track.name} ${t.track.artists[0].name}`
        );
    }

    return [];
}

// ▶️ PLAY SONG
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
        console.log('Error:', err);
        server.songs.shift();
        playSong(guild);
    }
}

// 🔥 READY
client.once('ready', () => {
    console.log(`🎶 ULTRA SPOTIFY BOT listo como ${client.user.tag}`);
});

// 💬 MESSAGE HANDLER
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== CANAL_BOT) return;

    const args = message.content.trim().split(' ');
    const command = args[0].toLowerCase();
    const server = getServer(message.guild.id);

    // ▶️ PLAY
    if (command === 'play') {
        const query = args.slice(1).join(' ');
        if (!query) return message.reply('❌ Escribe canción o link');

        const voice = message.member.voice.channel;
        if (!voice) return message.reply('❌ Entra a un canal de voz');

        let searchQueries = [];

        // 🎧 SPOTIFY
        if (query.includes('spotify.com')) {
            searchQueries = await resolveSpotify(query);
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

        // conectar si no está conectado
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

        return message.reply(`🎵 Añadido a la cola (${searchQueries.length} canciones)`);
    }

    // ⏭ NEXT
    if (command === 'next') {
        server.player.stop();
        server.songs.shift();
        playSong(message.guild);
        return message.reply('⏭ Siguiente');
    }

    // ⏹ STOP
    if (command === 'stop') {
        server.songs = [];
        server.current = null;

        if (server.connection) {
            server.connection.destroy();
            server.connection = null;
        }

        return message.reply('⏹ Detenido');
    }

    // ⏸ PAUSE
    if (command === 'pause') {
        server.player.pause();
        return message.reply('⏸ Pausado');
    }

    // ▶️ RESUME
    if (command === 'resume') {
        server.player.unpause();
        return message.reply('▶️ Reanudado');
    }

    // 📜 VER
    if (command === 'ver') {
        if (!server.songs.length) return message.reply('📭 Cola vacía');

        return message.reply(
            '📜 Cola:\n' +
            server.songs.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
        );
    }

    // 🧹 CLEAR
    if (command === 'clear') {
        server.songs = [];
        return message.reply('🧹 Cola limpiada');
    }

    // 🎵 NOW
    if (command === 'now') {
        if (!server.current) return message.reply('❌ Nada reproduciéndose');
        return message.reply(`🎶 Ahora suena: **${server.current.title}**`);
    }
});

client.login('MTUxNjgzOTcxNDE0Mzg2Mjk4NA.GsFmxx.HkQtRjkhxwuX4t64QRWdQU3IkZeuAQbyEVHwMs');
