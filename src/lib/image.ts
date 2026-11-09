/**
 * Reduz a foto no navegador antes de salvar (máx. 900px, JPEG 0.82).
 * Fotos de celular chegam com 3–8 MB; assim ficam com ~100 KB.
 * No backend real, o arquivo iria para um storage (S3/Supabase) e aqui só a URL.
 */
export async function resizeImage(file: File, max = 900, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Envie um arquivo de imagem (JPG, PNG ou WEBP).');
  if (file.size > 15 * 1024 * 1024) throw new Error('A imagem tem mais de 15 MB. Escolha uma foto menor.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler esta imagem.'));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
