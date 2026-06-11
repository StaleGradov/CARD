// ========== music.js ==========
// Музыкальный плеер

"use strict";

const playlist = [
    { name: 'Основная Тема', file: '1.mp3', duration: '1:05' },
    { name: 'Полурослики', file: '2.mp3', duration: '1:05' },
    { name: 'Феи', file: '3.mp3', duration: '2:43' },
    { name: 'Вампиры', file: '4.mp3', duration: '1:05' },
    { name: 'Драконы', file: '5.mp3', duration: '1:05' }
];

const MUSIC_BASE_URL = 'https://raw.githubusercontent.com/StaleGradov/CARD/main/images/';
let currentTrackIndex = 0, isPlaying = false, musicVolume = 0.3;
const bgMusic = document.getElementById('bgMusic');
const togglePlaylistBtn = document.getElementById('togglePlaylist');
const playlistPanel = document.getElementById('playlistPanel');
const closePlaylistBtn = document.getElementById('closePlaylist');
const nowPlayingText = document.querySelector('.now-playing-text');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevTrackBtn = document.getElementById('prevTrackBtn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const playlistTracks = document.getElementById('playlistTracks');

const savedVolume = localStorage.getItem('musicVolume');
if (savedVolume) { musicVolume = parseFloat(savedVolume); if (volumeSlider) volumeSlider.value = musicVolume * 100; if (volumeValue) volumeValue.textContent = Math.round(musicVolume * 100) + '%'; }
if (bgMusic) bgMusic.volume = musicVolume;
const savedTrack = localStorage.getItem('currentTrack');
if (savedTrack) currentTrackIndex = parseInt(savedTrack);

function initMusic() { if (playlist.length > 0) { loadTrack(currentTrackIndex); renderPlaylist(); } }
function loadTrack(index) { if (index < 0) index = playlist.length - 1; if (index >= playlist.length) index = 0; currentTrackIndex = index; if (bgMusic) bgMusic.src = MUSIC_BASE_URL + playlist[index].file; if (nowPlayingText) nowPlayingText.textContent = playlist[index].name; localStorage.setItem('currentTrack', currentTrackIndex); renderPlaylist(); updateActiveTrack(); }
function playMusic() { if (!bgMusic) return; bgMusic.play().then(() => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); }).catch(() => { isPlaying = false; updatePlayPauseButton(); }); }
function pauseMusic() { if (!bgMusic) return; bgMusic.pause(); isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); }
function togglePlayPause() { isPlaying ? pauseMusic() : playMusic(); }
function updatePlayPauseButton() { if (playPauseBtn) playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️'; }
function prevTrack() { currentTrackIndex--; if (currentTrackIndex < 0) currentTrackIndex = playlist.length - 1; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function nextTrack() { currentTrackIndex++; if (currentTrackIndex >= playlist.length) currentTrackIndex = 0; loadTrack(currentTrackIndex); if (isPlaying) playMusic(); }
function renderPlaylist() { if (!playlistTracks) return; playlistTracks.innerHTML = ''; playlist.forEach((track, index) => { const el = document.createElement('div'); el.className = 'playlist-track' + (index === currentTrackIndex ? ' active' : ''); el.innerHTML = `<span class="playlist-track-icon">🎵</span><div class="playlist-track-info"><div class="playlist-track-name">${track.name}</div><div class="playlist-track-duration">${track.duration}</div></div>${index === currentTrackIndex ? '<span class="playlist-track-playing">▶️</span>' : ''}`; el.addEventListener('click', () => { loadTrack(index); if (!isPlaying) playMusic(); else playMusic(); }); playlistTracks.appendChild(el); }); }
function updateActiveTrack() { document.querySelectorAll('.playlist-track').forEach((t, i) => { if (i === currentTrackIndex) { t.classList.add('active'); if (!t.querySelector('.playlist-track-playing')) { const s = document.createElement('span'); s.className = 'playlist-track-playing'; s.textContent = '▶️'; t.appendChild(s); } } else { t.classList.remove('active'); const s = t.querySelector('.playlist-track-playing'); if (s) s.remove(); } }); }
function changeVolume(value) { musicVolume = value / 100; if (bgMusic) bgMusic.volume = musicVolume; if (volumeValue) volumeValue.textContent = Math.round(musicVolume * 100) + '%'; localStorage.setItem('musicVolume', musicVolume); }
function togglePlaylistPanel() { if (playlistPanel) playlistPanel.classList.toggle('hidden'); }
function bindMusicEvents() {
    if (togglePlaylistBtn) togglePlaylistBtn.addEventListener('click', togglePlaylistPanel);
    if (closePlaylistBtn) closePlaylistBtn.addEventListener('click', () => { if (playlistPanel) playlistPanel.classList.add('hidden'); });
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevTrackBtn) prevTrackBtn.addEventListener('click', prevTrack);
    if (nextTrackBtn) nextTrackBtn.addEventListener('click', nextTrack);
    if (volumeSlider) volumeSlider.addEventListener('input', (e) => changeVolume(e.target.value));
    if (bgMusic) { bgMusic.addEventListener('ended', nextTrack); bgMusic.addEventListener('play', () => { isPlaying = true; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.add('playing'); }); bgMusic.addEventListener('pause', () => { isPlaying = false; updatePlayPauseButton(); if (togglePlaylistBtn) togglePlaylistBtn.classList.remove('playing'); }); bgMusic.addEventListener('error', nextTrack); }
}
document.addEventListener('click', function once() { if (playlist.length && bgMusic && !bgMusic.src) loadTrack(currentTrackIndex); document.removeEventListener('click', once); }, { once: true });
document.addEventListener('click', (e) => { if (playlistPanel && !playlistPanel.classList.contains('hidden') && !playlistPanel.contains(e.target) && !(togglePlaylistBtn && togglePlaylistBtn.contains(e.target))) playlistPanel.classList.add('hidden'); });
