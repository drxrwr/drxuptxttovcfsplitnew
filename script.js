// Ganti § jadi spasi
function parseWithSpasi(text) {
  return (text || "").replace(/§/g, " ").trim();
}

// Tambah + jika tidak diawali + atau 0
function formatPhoneNumber(num) {
  if (!num) return "";
  if (num.startsWith("+") || num.startsWith("0")) return num;
  return "+" + num;
}

// Tambahkan padding nol di depan nomor
function padNumber(num, totalLength) {
  return num.toString().padStart(totalLength, "0");
}

// ====================
// Upload & Drag/Drop
// ====================
const uploadArea = document.getElementById("uploadArea");
const txtFileInput = document.getElementById("txtFileInput");
const fileListDiv = document.getElementById("fileList");
let uploadedFiles = [];

// Klik area → buka file chooser
uploadArea.addEventListener("click", () => txtFileInput.click());

// Drag & Drop visual & handler
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});
txtFileInput.addEventListener("change", () => handleFiles(txtFileInput.files));

function handleFiles(files) {
  // convert FileList to Array and append
  uploadedFiles = [...uploadedFiles, ...Array.from(files)];
  renderFileList();
  readAllFiles();
}

function renderFileList() {
  fileListDiv.innerHTML = uploadedFiles
    .map((f, i) => `<div data-index="${i}">${f.name}</div>`)
    .join("");

  // aktifkan drag & drop sorting menggunakan SortableJS
  new Sortable(fileListDiv, {
    animation: 150,
    onEnd: () => {
      const newOrder = [];
      fileListDiv.querySelectorAll("div").forEach((el) => {
        const idx = parseInt(el.dataset.index, 10);
        newOrder.push(uploadedFiles[idx]);
      });
      uploadedFiles = newOrder;
      fileListDiv.innerHTML = uploadedFiles
        .map((f, i) => `<div data-index="${i}">${f.name}</div>`)
        .join("");
      new Sortable(fileListDiv, {
        animation: 150,
        onEnd: () => {
          const reorder = [];
          fileListDiv.querySelectorAll("div").forEach((el) => {
            reorder.push(uploadedFiles[el.dataset.index]);
          });
          uploadedFiles = reorder;
          readAllFiles();
        },
      });
      readAllFiles();
    },
  });
}

function readAllFiles() {
  if (!uploadedFiles.length) {
    document.getElementById("numberTextArea").value = "";
    document.getElementById("totalNumberInfo").innerText = `Total nomor: 0`;
    return;
  }

  let totalNumbers = 0;
  const readers = uploadedFiles.map((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const lines = (e.target.result || "")
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l);
        totalNumbers += lines.length;
        resolve({ name: file.name, lines });
      };
      reader.readAsText(file);
    });
  });

  Promise.all(readers).then((results) => {
    const allNumbers = results.flatMap((r) => r.lines);
    document.getElementById("numberTextArea").value = allNumbers.join("\n");
    document.getElementById("totalNumberInfo").innerText = `Total nomor: ${totalNumbers}`;
  });
}

// ====================
// Split ke VCF
// ====================
document.getElementById("splitVCFButton").addEventListener("click", async function () {
  const rawNumbers = document.getElementById("numberTextArea").value.trim();
  const nameBase = document.getElementById("contactNameInput").value.trim();
  let contactsPerFile = parseInt(document.getElementById("contactsPerFile").value);
  let startNumber = parseInt(document.getElementById("startNumberInput").value);
  if (isNaN(startNumber)) startNumber = 1;

  const fileNameRaw = document.getElementById("splitFileNameInput").value;
  const additionalFileNameRaw = document.getElementById("additionalFileNameInput").value;
  const useCustomName = document.getElementById("customNameCheckbox").checked;

  if (!rawNumbers) {
    alert("Isi daftar nomor tidak boleh kosong.");
    return;
  }

  const fileSources = uploadedFiles.length ? uploadedFiles : [{ name: "pasted.txt", isSynthetic: true }];

  const results = await Promise.all(
    fileSources.map((file) => {
      return new Promise((resolve) => {
        if (file.isSynthetic) {
          const lines = rawNumbers
            .split(/\r?\n/)
            .map((l) => formatPhoneNumber(l.trim()))
            .filter((l) => l);
          resolve({ name: file.name, lines });
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const lines = (e.target.result || "")
            .split(/\r?\n/)
            .map((l) => formatPhoneNumber(l.trim()))
            .filter((l) => l);
          resolve({ name: file.name, lines });
        };
        reader.readAsText(file);
      });
    })
  );

  const outputDiv = document.getElementById("splitVcfFiles");
  outputDiv.innerHTML = "";
  const zip = new JSZip();
  let globalIndexCounter = 0;

  for (let fileIndex = 0; fileIndex < results.length; fileIndex++) {
    const fileData = results[fileIndex];
    let fileChunks = [];

    if (isNaN(contactsPerFile)) {
      fileChunks = [fileData.lines];
    } else {
      for (let i = 0; i < fileData.lines.length; i += contactsPerFile) {
        fileChunks.push(fileData.lines.slice(i, i + contactsPerFile));
      }
    }

    fileChunks.forEach((chunk, chunkIdx) => {
      let vcfContent = "";
      chunk.forEach((number, idx) => {
        let contactName = "";
        if (useCustomName) {
          const localIdx = idx + 1;
          contactName = `${parseWithSpasi(nameBase)} ${parseWithSpasi(fileNameRaw)}${startNumber + fileIndex}${parseWithSpasi(additionalFileNameRaw)} ${localIdx}`.trim();
        } else {
          globalIndexCounter++;
          contactName = nameBase
            ? `${parseWithSpasi(nameBase)} ${globalIndexCounter}`
            : `kontak ${globalIndexCounter}`;
        }
        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL:${number}\nEND:VCARD\n`;
      });

      let splitFileName = parseWithSpasi(fileNameRaw) + (startNumber + fileIndex);
      let additionalNamePart = parseWithSpasi(additionalFileNameRaw);
      const currentFileName = additionalNamePart ? `${splitFileName} ${additionalNamePart}` : splitFileName;

      const blob = new Blob([vcfContent], { type: "text/vcard" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${currentFileName}.vcf`;
      link.textContent = `Download ${link.download}`;
      outputDiv.appendChild(link);
      outputDiv.appendChild(document.createElement("br"));

      zip.file(`${currentFileName}.vcf`, vcfContent);
    });
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipLink = document.createElement("a");
  zipLink.href = URL.createObjectURL(zipBlob);
  zipLink.download = `all_split_vcf.zip`;
  zipLink.textContent = `📦 Download Semua (${zipLink.download})`;
  zipLink.style.fontWeight = "bold";
  zipLink.style.display = "block";
  zipLink.style.marginTop = "20px";
  outputDiv.appendChild(zipLink);
});
