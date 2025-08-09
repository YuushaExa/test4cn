class EpubGenerator {
  constructor(novelData) {
    this.novelData = novelData;
    this.workerUrl = 'https://curly-pond-9050.yuush.workers.dev';
  }

  async generate(logCallback = console.log) {
    const log = msg => logCallback(msg);
    const zip = new JSZip();
    const idGen = (() => { let n = 0; return () => `id-${++n}`; })();

    /* 1. mimetype (must be first & uncompressed) */
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    /* 2. META-INF & OEBPS folders */
    const meta = zip.folder('META-INF');
    meta.file('container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    const oebps = zip.folder('OEBPS');
    const toc = [];

    /* 3. download cover */
    let coverFileName = '';
    if (this.novelData.metadata.cover) {
      try {
        const res = await fetch(`${this.workerUrl}/api/raw?url=${encodeURIComponent(this.novelData.metadata.cover)}`);
        if (!res.ok) throw new Error('cover fetch failed');
        const blob = await res.blob();
        coverFileName = 'cover.jpg';
        oebps.file(coverFileName, blob, { compression: 'DEFLATE' });
      } catch (e) {
        log('Cover skipped: ' + e.message);
      }
    }

    /* 3b. cover page XHTML (if cover exists) */
    if (coverFileName) {
      const coverPage = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${this.novelData.metadata.title}</title><meta charset="utf-8"/></head>
<body style="margin:0; text-align:center;">
  <img style="height:auto;width:100%;border-radius:5px;" src="${coverFileName}" alt="Cover"/>
    <h1>${this.novelData.metadata.title}</h1>
    <p><strong>Author:</strong> ${this.novelData.metadata.author.join(', ')}</p>
</body></html>`;
      oebps.file('cover.xhtml', coverPage);
      toc.push({ id: 'cover-page', href: 'cover.xhtml', title: 'Cover', isCover: true });
    }

/* 4. Information page */
const infoPage = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Information</title><meta charset="utf-8"/></head>
<body>
  <h1>${this.novelData.metadata.title}</h1>
  <p><strong>Author:</strong> ${this.novelData.metadata.author.join(', ')}</p>
  <p><strong>Status:</strong> ${this.novelData.metadata.status}</p>
  ${this.novelData.metadata.altitile ? `<p><strong>Alternative Title:</strong> ${Array.isArray(this.novelData.metadata.altitile) ? this.novelData.metadata.altitile.join(', ') : this.novelData.metadata.altitile}</p>` : ''}
  ${this.novelData.metadata.language ? `<p><strong>Original Language:</strong> ${this.novelData.metadata.language}</p>` : ''}
  ${this.novelData.metadata.originalPublisher ? `<p><strong>Original Publisher:</strong> ${this.novelData.metadata.originalPublisher}</p>` : ''}
  ${this.novelData.metadata.statuscoo ? `<p><strong>Original Status:</strong> ${this.novelData.metadata.statuscoo}</p>` : ''}
  ${this.novelData.metadata.genres.length ? `<p><strong>Genres:</strong> ${this.novelData.metadata.genres.join(', ')}</p>` : ''}
  <h3>Description</h3>
  <p>${this.novelData.metadata.description}</p>
</body>
</html>`;
    oebps.file('info.xhtml', infoPage);
    toc.push({ id: 'info-page', href: 'info.xhtml', title: 'Information' });

    /* 5. chapters */
    log('Processing chapters for EPUB...');
    this.novelData.chapters.forEach((ch, idx) => {
      const file = `chap${idx + 1}.xhtml`;

      const processedContent = (ch.content || 'Content not found.')
        .replace(/&nbsp;/g, '&#160;')
        .replace(/<br\s*>/gi, '<br />');

      const html = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${ch.title}</title>
  <meta charset="utf-8"/>
</head>
<body>
  <h1>${ch.title}</h1>
  ${processedContent}
</body>
</html>`;
      oebps.file(file, html);
      toc.push({ id: `ch-${idx + 1}`, href: file, title: ch.title });
    });

    /* 5a. Create TOC page (XHTML) */
    const tocPage = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
  <meta charset="utf-8"/>
  <style type="text/css">
    body { font-family: sans-serif; line-height: 1.5; }
    h1 { text-align: center; }
    li { margin: 0.5em 0; }
  </style>
</head>
<body>
  <h1>Table of Contents</h1>
  <nav epub:type="toc" id="toc">
    <ol>
      <li><a href="cover.xhtml">Cover</a></li>
      <li><a href="info.xhtml">Information</a></li>
      <li><a href="toc.xhtml">Table of Contents</a></li>
      ${this.novelData.chapters.map((ch, idx) => 
        `<li><a href="chap${idx + 1}.xhtml">${ch.title}</a></li>`
      ).join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;

    oebps.file('toc.xhtml', tocPage);
    toc.push({ id: 'toc-page', href: 'toc.xhtml', title: 'Table of Contents' });
    
    /* 7. NCX (Table of Contents) */
    const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${'urn:uuid:' + Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${this.novelData.metadata.title}</text></docTitle>
  <navMap>
    ${toc.map((t, i) => `<navPoint id="${t.id}" playOrder="${i + 1}">
      <navLabel><text>${t.title}</text></navLabel>
      <content src="${t.href}"/>
    </navPoint>`).join('\n  ')}
  </navMap>
</ncx>`;
    oebps.file('toc.ncx', ncx);

    /* 6. OPF (content.opf) */
    const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${this.novelData.metadata.title}</dc:title>
    <dc:creator>${this.novelData.metadata.author.join(', ')}</dc:creator>
    <dc:language>en</dc:language>
${this.novelData.metadata.genres.map(genre => `<dc:subject>${genre}</dc:subject>`).join('\n')}
<dc:identifier id="BookId">urn:uuid:${crypto.randomUUID()}</dc:identifier>
    <dc:description>${(this.novelData.metadata.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</dc:description>
      <meta property="dcterms:modified">${new Date().toISOString()}</meta>
    <meta property="nav">toc.xhtml</meta>
    ${coverFileName ? '<meta name="cover" content="cover-image"/>' : ''}
  </metadata>
  <manifest>
    <item id="nav" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
     <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  ${coverFileName ? `<item id="cover-image" href="${coverFileName}" media-type="image/jpg"/>` : ''}
  <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>
  ${toc.map(t => `<item id="${t.id}" href="${t.href}" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine toc="nav">
    <itemref idref="cover-page"/>
    <itemref idref="info-page"/>
    <itemref idref="toc-page"/>    
  ${toc.map(t => `<itemref idref="${t.id}"/>`).join('\n    ')}
  </spine>
</package>`;
    oebps.file('content.opf', opf);

    /* 8. Generate EPUB file */
    log('Generating EPUB file, please wait...');
    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
  }

  async download(logCallback = console.log) {
    const blob = await this.generate(logCallback);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.novelData.metadata.title.replace(/[^a-z0-9]/gi, '_')}.epub`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    logCallback('EPUB download initiated!');
  }
}
