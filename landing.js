// // const video3 = document.getElementById('video-3');
// // const video2 = document.getElementById('video-2');
// const video = document.getElementById('video');

// // Check if the browser is running on macOS
// const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// // Set video sources based on the platform
// if (isMac) {
//     video.src = 'Links.mov';
//     video2.src = 'Embeddings.mov';
//     video3.src = 'Links_english.mov';
// } else {
//     video.src = 'Links.mp4';
//     video2.src = 'Embeddings.mp4';
//     video3.src = 'Links_english.mp4';
// }

// let isUpdating = false;

// function waitForVideosToLoad(videos) {
//     return Promise.all(videos.map(video => {
//         return new Promise((resolve, reject) => {
//             if (video.readyState >= 2) {
//                 resolve();
//             } else {
//                 video.addEventListener('loadeddata', resolve, { once: true });
//                 video.addEventListener('error', () => reject(new Error('Failed to load video')), { once: true });
//             }
//         });
//     }));
// }

// function updateVideoTime(scrolledEle) {
//     const scrollY = scrolledEle.scrollTop;
//     const maxScroll = scrolledEle.scrollHeight - scrolledEle.clientHeight;
//     const scrollFraction = scrollY / maxScroll;

//     if (isFinite(video.duration)) {
//         const videoDuration = video.duration;
//         if (scrollFraction >= 0.2 && scrollFraction <=0.6){
//             const videoTime = scrollFraction * videoDuration;
//             if (isFinite(videoTime)) {
//                 let videoTimeRound = parseFloat(videoTime.toFixed(2))
//                 video.currentTime = videoTimeRound;
//             }
//         }
//     }

//     // if (isFinite(video2.duration)) {
//     //     if (scrollFraction >= 0.5 && scrollFraction <=0.8){
//     //         const videoDuration2 = video2.duration;
//     //         const videoTime2 = scrollFraction * videoDuration2;
//     //         if (isFinite(videoTime2)) {
//     //             video2.currentTime = videoTime2;
//     //         }
//     //     }
//     // }

//     // if (isFinite(video3.duration)) {
//     //     if (scrollFraction >= 0.8 && scrollFraction <=1.2){
//     //         const videoDuration3 = video3.duration;
//     //         const videoTime3 = scrollFraction * videoDuration3;
//     //         if (isFinite(videoTime3)) {
//     //             video3.currentTime = videoTime3;
//     //         }
//     //     }
//     // }
//     isUpdating = false;
// }

// function debouncedUpdateVideoTime(scrolledEle) {
//     if (!isUpdating) {
//         isUpdating = true;
//         window.requestAnimationFrame(() => updateVideoTime(scrolledEle));
//     }
// }

// video.addEventListener('loadeddata', () => {
//     updateVideoTime(document.documentElement); // Initial call to set video time
// });

// // video2.addEventListener('loadeddata', () => {
// //     updateVideoTime(document.documentElement); // Initial call to set video time
// // });

// // video3.addEventListener('loadeddata', () => {
// //     updateVideoTime(document.documentElement); // Initial call to set video time
// // });

// // window.addEventListener('load', () => {
// //     if (video2.readyState >= 2) {
// //         updateVideoTime(document.documentElement); // Initial call to set video time
// //     }
// // });

// // document.addEventListener('DOMContentLoaded', () => {
// //     const video2 = document.getElementById('video-2');
// // });

// waitForVideosToLoad([video])
//     .then(() => {
//         updateVideoTime(document.documentElement); // Initial call to set video time

//         document.addEventListener('scroll', () => {
//             debouncedUpdateVideoTime(document.documentElement);
//         });
//     })
//     .catch(error => {
//         console.error(error.message);
//     });

// document.addEventListener('scroll', () => {
//     waitForVideosToLoad([video])
//     .then(() => {
//         updateVideoTime(document.documentElement); // Initial call to set video time
//     })
//     .catch(error => {
//         console.error(error.message);
//     });
// });




