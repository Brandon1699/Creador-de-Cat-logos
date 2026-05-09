const { jsPDF } = window.jspdf;

// Cargar la fuente manualmente para asegurar que esté lista para el canvas
const customFont = new FontFace('Integral CF', 'url(fonnts.com-Integral_CF_Regular.ttf)');
customFont.load().then((font) => {
    document.fonts.add(font);
    renderPreviews(); // Re-renderizar por si la fuente cargó después de que el usuario escribió algo
});

const fileInput = document.getElementById('image-upload');
const catalogNameInput = document.getElementById('catalog-name');
const generateBtn = document.getElementById('generate-btn');
const previewContainer = document.getElementById('preview-container');
const watermarkSelect = document.getElementById('watermark-select');

// Coordenadas especificadas por el usuario para la imagen y el texto
const PHOTO_BOX = { x: 57.9, y: 58.4, w: 962.4, h: 1634.6 };
const TEXT_BOX = { x: 409.3, y: 1715.5, w: 611, h: 162 };

// Cargar la imagen de fondo desde Base64
const fondoImg = new Image();
let bgReady = false;

fondoImg.onload = () => {
    bgReady = true;
};
fondoImg.src = FONDO_B64;

// Cargar las marcas de agua desde Base64
const logoBlanco = new Image();
logoBlanco.src = LOGO_BLANCO_B64;

const logoNegro = new Image();
logoNegro.src = LOGO_NEGRO_B64;

let uploadedImages = []; // Array of image elements

// Manejar la subida de imágenes
fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

    if (uploadedImages.length === 0) {
        previewContainer.innerHTML = ''; // Quitar estado vacío
    }

    let loadedCount = 0;
    const newImages = new Array(files.length);

    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                newImages[index] = img; // Mantener el orden original de subida
                loadedCount++;
                if (loadedCount === files.length) {
                    uploadedImages = uploadedImages.concat(newImages.filter(i => i));
                    renderPreviews();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

// Actualizar las previsualizaciones si cambia el nombre del catálogo o la marca de agua
catalogNameInput.addEventListener('input', () => {
    renderPreviews();
});
watermarkSelect.addEventListener('change', () => {
    renderPreviews();
});

// Función para dibujar una página entera (Fondo + Foto + Marca de Agua + Texto)
function drawPage(canvas, photoImg, catalogName) {
    const ctx = canvas.getContext('2d');
    
    // Dimensiones del lienzo coinciden con el fondo (1080x1920 aprox)
    canvas.width = fondoImg.width;
    canvas.height = fondoImg.height;

    // 1. Dibujar el fondo completo
    ctx.drawImage(fondoImg, 0, 0);

    // *Se eliminó el relleno gris fijo para que se vea el rectángulo gris original del fondo.png*

    // 2. Dibujar la foto usando lógica CONTAIN
    const boxRatio = PHOTO_BOX.w / PHOTO_BOX.h;
    const imgRatio = photoImg.width / photoImg.height;

    let drawW, drawH, drawX, drawY;

    if (imgRatio > boxRatio) {
        // La imagen es más ancha que la caja
        drawW = PHOTO_BOX.w;
        drawH = drawW / imgRatio;
        drawX = PHOTO_BOX.x;
        drawY = PHOTO_BOX.y + (PHOTO_BOX.h - drawH) / 2;
    } else {
        // La imagen es más alta que la caja
        drawH = PHOTO_BOX.h;
        drawW = drawH * imgRatio;
        drawX = PHOTO_BOX.x + (PHOTO_BOX.w - drawW) / 2;
        drawY = PHOTO_BOX.y;
    }

    ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);

    // 3. Dibujar la Marca de Agua (Semitraslúcida en el centro de la foto)
    const wmLogo = watermarkSelect.value === 'blanco' ? logoBlanco : logoNegro;
    if (wmLogo.complete && wmLogo.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5; // Marca de agua semitraslúcida (50%)
        
        // Determinar el tamaño de la marca de agua (ej. 60% del ancho de la caja o tamaño original si es menor)
        const maxW = PHOTO_BOX.w * 0.6;
        let wmW = wmLogo.width;
        let wmH = wmLogo.height;
        
        if (wmW > maxW) {
            const ratio = maxW / wmW;
            wmW = maxW;
            wmH = wmH * ratio;
        }

        const wmX = PHOTO_BOX.x + (PHOTO_BOX.w - wmW) / 2;
        const wmY = PHOTO_BOX.y + (PHOTO_BOX.h - wmH) / 2;

        ctx.drawImage(wmLogo, wmX, wmY, wmW, wmH);
        ctx.restore();
    }

    // 4. Dibujar el nombre del catálogo si existe
    if (catalogName) {
        ctx.fillStyle = '#000000'; // Texto negro
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Usar la fuente Integral CF (En mayúsculas por requisito)
        ctx.font = '50px "Integral CF", sans-serif'; 
        
        const textX = TEXT_BOX.x + (TEXT_BOX.w / 2);
        const textY = TEXT_BOX.y + (TEXT_BOX.h / 2);
        
        ctx.fillText(catalogName.toUpperCase(), textX, textY);
    }
}

// Renderizar las vistas previas en la UI
function renderPreviews() {
    if (uploadedImages.length === 0) return;
    
    previewContainer.innerHTML = '';
    const catalogName = catalogNameInput.value;

    uploadedImages.forEach((img) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-canvas-wrapper';
        
        const canvas = document.createElement('canvas');
        drawPage(canvas, img, catalogName);
        
        wrapper.appendChild(canvas);
        previewContainer.appendChild(wrapper);
    });
}

// Lógica de generación del PDF
generateBtn.addEventListener('click', () => {
    if (uploadedImages.length === 0) {
        alert('Por favor, sube al menos una imagen.');
        return;
    }
    
    if (!bgReady) {
        alert('Cargando el fondo, por favor espera un segundo e intenta de nuevo.');
        return;
    }

    // Deshabilitar el botón durante la generación
    const originalText = generateBtn.innerText;
    generateBtn.innerText = 'Generando PDF...';
    generateBtn.disabled = true;

    // Timeout para permitir que la UI se actualice
    setTimeout(() => {
        try {
            // Inicializar el PDF con el tamaño del fondo
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [fondoImg.width, fondoImg.height]
            });

            const catalogName = catalogNameInput.value;

            uploadedImages.forEach((img, index) => {
                const canvas = document.createElement('canvas');
                drawPage(canvas, img, catalogName);

                // Convertir el canvas a imagen JPG con compresión ligera (0.9)
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                
                if (index > 0) {
                    pdf.addPage([fondoImg.width, fondoImg.height], 'portrait');
                }
                pdf.addImage(imgData, 'JPEG', 0, 0, fondoImg.width, fondoImg.height);
            });

            // Descargar el archivo
            const filename = catalogName ? `${catalogName.replace(/[^a-zA-Z0-9]/gi, '_')}.pdf` : 'Catalogo_Gritt.pdf';
            pdf.save(filename);
            
        } catch (error) {
            console.error(error);
            alert('Hubo un error al generar el PDF. Revisa la consola.');
        } finally {
            generateBtn.innerText = originalText;
            generateBtn.disabled = false;
        }
    }, 100);
});
