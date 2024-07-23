const video2 = document.getElementById('video-2');
const video = document.getElementById('video');
let isUpdating = false;

function updateVideoTime(scrolledEle) {
    const scrollY = scrolledEle.scrollTop;
    const maxScroll = scrolledEle.scrollHeight - scrolledEle.clientHeight;
    const scrollFraction = scrollY / maxScroll;

    if (isFinite(video.duration)) {
        const videoDuration = video.duration;
        const videoTime = scrollFraction * videoDuration;
        if (isFinite(videoTime)) {
            let videoTimeRound = parseFloat(videoTime.toFixed(2))
            video.currentTime = videoTimeRound;
        }
    }

    if (isFinite(video2.duration)) {
        const videoDuration2 = video2.duration;
        const videoTime2 = scrollFraction * videoDuration2;
        if (isFinite(videoTime2)) {
            video2.currentTime = videoTime2;
        }
    }
    isUpdating = false;
}

function debouncedUpdateVideoTime(scrolledEle) {
    if (!isUpdating) {
        isUpdating = true;
        window.requestAnimationFrame(() => updateVideoTime(scrolledEle));
    }
}

video.addEventListener('loadeddata', () => {
    updateVideoTime(document.documentElement); // Initial call to set video time
});

video2.addEventListener('loadeddata', () => {
    updateVideoTime(document.documentElement); // Initial call to set video time
});

window.addEventListener('load', () => {
    if (video2.readyState >= 2) {
        updateVideoTime(document.documentElement); // Initial call to set video time
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const video2 = document.getElementById('video-2');
});

document.addEventListener('scroll', () => {
    debouncedUpdateVideoTime(document.documentElement);
});




