document.getElementById('uploadForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const uploadProgress = document.getElementById('uploadProgress');
  const convertProgress = document.getElementById('convertProgress');
  const uploadBar = document.getElementById('uploadBar');
  const convertBar = document.getElementById('convertBar');
  const uploadStatus = document.getElementById('uploadStatus');
  const convertStatus = document.getElementById('convertStatus');
  const imageContainer = document.getElementById('imageContainer');
  const results = document.getElementById('results');

  uploadProgress.classList.remove('hidden');
  uploadBar.style.width = '0%';
  uploadStatus.textContent = 'Uploading...';

  convertProgress.classList.add('hidden');
  results.classList.add('hidden');
  imageContainer.innerHTML = '';

  const formData = new FormData(this);
  const xhr = new XMLHttpRequest();

  xhr.open('POST', '/convert');

  xhr.upload.addEventListener('progress', function (e) {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;
      uploadBar.style.width = `${percent}%`;
    }
  });

  xhr.onload = async function () {
    uploadBar.style.width = '100%';
    uploadStatus.textContent = 'Upload complete. Starting conversion...';

    convertProgress.classList.remove('hidden');
    convertBar.style.width = '0%';
    convertStatus.textContent = 'Converting...';

    let progress = 0;
    const convertSim = setInterval(() => {
      progress += 10;
      convertBar.style.width = `${progress}%`;
      if (progress >= 100) {
        clearInterval(convertSim);
        convertStatus.textContent = 'Conversion done.';
        showResults(JSON.parse(xhr.responseText));
      }
    }, 200);
  };

  xhr.send(formData);
});

function showResults(files) {
  const results = document.getElementById('results');
  const imageContainer = document.getElementById('imageContainer');

  files.forEach(file => {
    const wrapper = document.createElement('div');

    const img = document.createElement('img');
    img.src = `/converted/${file}`;
    wrapper.appendChild(img);

    const link = document.createElement('a');
    link.href = `/converted/${file}`;
    link.download = file;
    link.textContent = 'Download';
    link.className = 'download-link';
    wrapper.appendChild(link);

    imageContainer.appendChild(wrapper);
  });

  results.classList.remove('hidden');
}
