let player;
let keyMap = {};
let tempStart = null;
let tempEnd = null;
let playMode = false;

function extractVideoId(url) {
    const reg = /(?:v=|\.be\/|embed\/)([\w-]{11})/;
    const match = url.match(reg);
    return match ? match[1] : url;
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: {
            playsinline: 1
        },
        events: {
            onReady: onPlayerReady
        }
    });
}

function onPlayerReady() {
    player.mute();
    player.setPlaybackRate(2);
    player.playVideo();
}

function loadVideo() {
    const url = document.getElementById('video-url').value.trim();
    if (!url) return;
    const id = extractVideoId(url);
    player.loadVideoById(id);
}

document.getElementById('load-video').addEventListener('click', loadVideo);

document.getElementById('set-start').addEventListener('click', () => {
    if (player) tempStart = player.getCurrentTime();
});

document.getElementById('set-end').addEventListener('click', () => {
    if (player) tempEnd = player.getCurrentTime();
});

document.getElementById('add-mapping').addEventListener('click', () => {
    const key = document.getElementById('key-input').value.trim();
    if (!key || tempStart === null || tempEnd === null) return;
    keyMap[key] = { start: tempStart, end: tempEnd };
    tempStart = tempEnd = null;
    document.getElementById('key-input').value = '';
    updateTable();
    localStorage.setItem('beatPadMap', JSON.stringify(keyMap));
});

document.getElementById('play-mode-btn').addEventListener('click', () => {
    playMode = true;
    document.getElementById('edit-mode').style.display = 'none';
    document.getElementById('play-mode').style.display = 'block';
    player.setPlaybackRate(1);
    player.mute();
    player.playVideo();
});

document.getElementById('exit-play-mode').addEventListener('click', () => {
    playMode = false;
    document.getElementById('edit-mode').style.display = 'block';
    document.getElementById('play-mode').style.display = 'none';
});

document.addEventListener('keydown', (e) => {
    if (!playMode) return;
    const map = keyMap[e.key];
    if (!map) return;
    player.seekTo(map.start, true);
    player.unMute();
    player.playVideo();
    setTimeout(() => {
        player.mute();
    }, (map.end - map.start) * 1000);
});

function updateTable() {
    const tbody = document.querySelector('#mappings-table tbody');
    tbody.innerHTML = '';
    for (const key in keyMap) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${key}</td><td>${keyMap[key].start.toFixed(2)}</td><td>${keyMap[key].end.toFixed(2)}</td>`;
        tbody.appendChild(row);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('beatPadMap');
    if (saved) {
        try {
            keyMap = JSON.parse(saved);
            updateTable();
        } catch {}
    }
});
