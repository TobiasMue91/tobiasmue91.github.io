// Fixtures for the Everything Converter test suite. This file is injected into the real
// page, so it can use the page's own converters to derive the formats that have no
// convenient literal form (QOI, PPM, MIDI, FASTA...). Everything here is generated, so the
// repo carries no binary test assets.
//
// Loaded by test/everything_converter.mjs - not part of the tool itself.
window.__buildFixtures = async function () {
    const log = [];
    const enc = s => new Blob([s]);
    const F = {};

    // --- text and data formats: hand-authored, deliberately awkward -------------------
    F['text/plain'] = enc('Hello world.\nSecond line with some words.\nThird line here.\n');
    F['application/json'] = enc('[{"name":"Ada","age":36,"city":"London"},{"name":"Bob","age":41,"city":"Paris"}]');
    F['application/jsonl'] = enc('{"a":1,"b":"x"}\n{"a":2,"b":"y"}\n');
    F['application/json5'] = enc("{a: 1, b: 'two', /*c*/ d: [1,2,3],}");
    F['text/csv'] = enc('name,age,city\nAda,36,London\nBob,41,Paris\n');
    F['text/tab-separated-values'] = enc('name\tage\tcity\nAda\t36\tLondon\nBob\t41\tParis\n');
    F['text/yaml'] = enc('- name: Ada\n  age: 36\n- name: Bob\n  age: 41\n');
    F['application/xml'] = enc('<?xml version="1.0"?>\n<root><item><name>Ada</name><age>36</age></item>'
        + '<item><name>Bob</name><age>41</age></item></root>');
    F['application/toml'] = enc('title = "demo"\ncount = 3\nenabled = true\ntags = ["x", "y"]\n\n[[items]]\nn = 1\n\n[[items]]\nn = 2\n');
    F['application/ini'] = enc('[main]\ntitle = demo\ncount = 3\n');
    F['application/x-properties'] = enc('title=demo\ncount=3\n');
    F['application/x-env'] = enc('TITLE=demo\nCOUNT=3\n');
    F['application/x-sexp'] = enc('((title "demo") (count 3))');
    // Includes a table, so mdtable-to-csv has something to find.
    F['text/markdown'] = enc('# Title\n\nSome **bold** text and a [link](https://example.com).\n\n'
        + '- one\n- two\n\n| name | age |\n| --- | --- |\n| Ada | 36 |\n| Bob | 41 |\n');
    F['text/html'] = enc('<!DOCTYPE html><html><head><title>T</title></head><body><h1>Title</h1>'
        + '<p>Some <b>bold</b> text.</p><table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>');
    F['text/x-rst'] = enc('Title\n=====\n\nSome *emphasis* text.\n\n- one\n- two\n');
    F['text/x-textile'] = enc('h1. Title\n\nSome *strong* text.\n\n* one\n* two\n');
    F['text/x-asciidoc'] = enc('= Title\n\nSome *bold* text.\n\n* one\n* two\n');
    F['application/x-subrip'] = enc('1\n00:00:01,000 --> 00:00:03,000\nFirst line\n\n2\n00:00:04,500 --> 00:00:06,000\nSecond line\n');
    F['text/vtt'] = enc('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nFirst line\n\n2\n00:00:04.500 --> 00:00:06.000\nSecond line\n');
    F['application/x-lrc'] = enc('[00:01.00]First line\n[00:04.50]Second line\n');
    F['application/x-morse'] = enc('.... . .-.. .-.. --- / .-- --- .-. .-.. -..');
    F['text/x-braille'] = enc('⠓⠑⠍⠏');
    F['text/calendar'] = enc('BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:1@x\nSUMMARY:Meeting\n'
        + 'DTSTART:20260101T100000Z\nDTEND:20260101T110000Z\nEND:VEVENT\nEND:VCALENDAR\n');
    F['text/vcard'] = enc('BEGIN:VCARD\nVERSION:3.0\nFN:Ada Lovelace\nN:Lovelace;Ada;;;\n'
        + 'EMAIL:ada@example.com\nTEL:+44 20 1234\nEND:VCARD\n');
    F['application/x-base64-source'] = enc(btoa('Hello world.'));
    F['application/sql'] = enc("INSERT INTO t (a,b) VALUES (1,'x');\n");
    F['text/x-hexdump'] = enc('00000000: 4865 6c6c 6f                             Hello\n');
    F['text/css+palette'] = enc(':root{--c1:#112233;--c2:#445566;}');
    F['text/plain+ocr'] = enc('OCR text sample\n');
    F['text/plain+hashes'] = enc('md5 abc\n');
    F['application/octet-stream'] = new Blob([Uint8Array.from({length: 600}, (_, i) => (i * 131 + 7) & 255)]);
    F['model/obj'] = enc('v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 2 3\nf 1 3 4\nf 1 4 2\nf 2 4 3\n');

    // --- images ----------------------------------------------------------------------
    const canvasFixture = async (w, h) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#204080');
        g.addColorStop(1, '#f0c020');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#fff';
        x.font = 'bold 20px sans-serif';
        x.fillText('AB', 8, 30);
        x.fillStyle = '#c03040';
        x.fillRect(w * 0.6, h * 0.5, w * 0.3, h * 0.3);
        return c;
    };
    const srcCanvas = await canvasFixture(64, 48);
    const toBlob = (c, mime) => new Promise(r => c.toBlob(r, mime));
    F['image/png'] = await toBlob(srcCanvas, 'image/png');
    F['image/jpeg'] = await toBlob(srcCanvas, 'image/jpeg');
    F['image/webp'] = await toBlob(srcCanvas, 'image/webp');
    F['image/svg+xml'] = new Blob([
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48">'
        + '<rect width="64" height="48" fill="#248"/><circle cx="32" cy="24" r="16" fill="#fc0"/></svg>'
    ], {type: 'image/svg+xml'});

    // --- audio: half a second of a rising tone, 8 kHz mono 16-bit --------------------
    const wavFixture = (melody) => {
        const sr = 8000, dur = melody ? 1.2 : 0.5, n = Math.round(sr * dur);
        const buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
        const ws = (o, s) => {
            for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i));
        };
        ws(0, 'RIFF');
        d.setUint32(4, 36 + n * 2, true);
        ws(8, 'WAVEfmt ');
        d.setUint32(16, 16, true);
        d.setUint16(20, 1, true);
        d.setUint16(22, 1, true);
        d.setUint32(24, sr, true);
        d.setUint32(28, sr * 2, true);
        d.setUint16(32, 2, true);
        d.setUint16(34, 16, true);
        ws(36, 'data');
        d.setUint32(40, n * 2, true);
        // A few held notes read as a melody; a continuous sweep does not.
        const notes = [261.63, 329.63, 392.0, 523.25];
        let phase = 0;
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            const f = melody ? notes[Math.min(notes.length - 1, Math.floor(t / (dur / notes.length)))] : 440 + 220 * t;
            phase += 2 * Math.PI * f / sr;
            const env = Math.min(1, 8 * t) * Math.min(1, 8 * (dur - t));
            d.setInt16(44 + i * 2, Math.sin(phase) * 0.7 * env * 32767, true);
        }
        return new Blob([buf], {type: 'audio/wav'});
    };
    F['audio/wav'] = wavFixture(true);

    // --- 3D: a binary STL tetrahedron ------------------------------------------------
    const tris = [[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]],
        [[0, 0, 0], [0, 0, 1], [1, 0, 0]], [[1, 0, 0], [0, 0, 1], [0, 1, 0]]];
    const stl = new ArrayBuffer(84 + tris.length * 50), sd = new DataView(stl);
    sd.setUint32(80, tris.length, true);
    let so = 84;
    for (const t of tris) {
        so += 12;                                   // zeroed normal
        for (const v of t) {
            for (let i = 0; i < 3; i++) sd.setFloat32(so + i * 4, v[i], true);
            so += 12;
        }
        so += 2;                                    // attribute byte count
    }
    F['model/stl'] = new Blob([stl], {type: 'model/stl'});

    // --- a JPEG carrying a real EXIF APP1 block, so the EXIF reader has work to do ----
    F['image/jpeg+exif'] = await (async () => {
        const plain = new Uint8Array(await F['image/jpeg'].arrayBuffer());
        // Minimal little-endian TIFF IFD with Make, Model and Orientation.
        const entries = [[0x010F, 2, 6, 'Canon\0'], [0x0110, 2, 5, 'EOS\0\0'], [0x0112, 3, 1, 1]];
        const ifdLen = 2 + entries.length * 12 + 4;
        const strings = entries.filter(e => typeof e[3] === 'string');
        const tiff = new ArrayBuffer(8 + ifdLen + strings.reduce((a, e) => a + e[3].length, 0));
        const td = new DataView(tiff), tu = new Uint8Array(tiff);
        tu[0] = tu[1] = 0x49;
        td.setUint16(2, 42, true);
        td.setUint32(4, 8, true);
        td.setUint16(8, entries.length, true);
        let o = 10, strAt = 8 + ifdLen;
        for (const [tag, type, count, val] of entries) {
            td.setUint16(o, tag, true);
            td.setUint16(o + 2, type, true);
            td.setUint32(o + 4, count, true);
            if (typeof val === 'string') {
                td.setUint32(o + 8, strAt, true);
                for (let i = 0; i < val.length; i++) tu[strAt + i] = val.charCodeAt(i);
                strAt += val.length;
            } else td.setUint16(o + 8, val, true);
            o += 12;
        }
        td.setUint32(o, 0, true);
        const header = new TextEncoder().encode('Exif\0\0');
        const payload = new Uint8Array(header.length + tiff.byteLength);
        payload.set(header, 0);
        payload.set(tu, header.length);
        const app1 = new Uint8Array(4 + payload.length);
        app1[0] = 0xFF;
        app1[1] = 0xE1;
        app1[2] = (payload.length + 2) >> 8;
        app1[3] = (payload.length + 2) & 255;
        app1.set(payload, 4);
        // Splice APP1 in straight after the SOI marker.
        const out = new Uint8Array(plain.length + app1.length);
        out.set(plain.subarray(0, 2), 0);
        out.set(app1, 2);
        out.set(plain.subarray(2), 2 + app1.length);
        return new Blob([out], {type: 'image/jpeg'});
    })();

    // --- formats best produced by the tool's own (dependency-free) converters ---------
    const run = async (id, blob, from, to) => {
        const c = converters.find(x => x.id === id);
        if (!c) throw new Error('no converter ' + id);
        return await c.convert(blob, from, to, {...DEFAULT_OPTIONS},
            {file: new File([blob], 'fixture'), name: 'fixture'});
    };
    const derived = [
        ['image/bmp', 'canvas-image', 'image/png'],
        ['image/tiff', 'canvas-image', 'image/png'],
        ['image/x-icon', 'image-to-ico', 'image/png'],
        ['image/x-portable-pixmap', 'image-to-ppm', 'image/png'],
        ['image/x-portable-graymap', 'image-to-pgm', 'image/png'],
        ['image/x-portable-bitmap', 'image-to-pbm', 'image/png'],
        ['image/qoi', 'image-to-qoi', 'image/png'],
        ['image/gif', 'image-to-gif', 'image/png'],
        ['application/cbor', 'json-to-cbor', 'application/json'],
        ['application/x-fasta', 'any-to-dna', 'text/plain'],
        ['audio/midi', 'image-to-midi', 'image/png'],
    ];
    for (const [mime, id, srcMime] of derived) {
        try {
            F[mime] = await run(id, F[srcMime], srcMime, mime);
        } catch (e) {
            log.push({fixture: mime, via: id, error: String((e && e.message) || e)});
        }
    }

    window.__F = F;
    return {built: Object.keys(F).filter(k => F[k]).length, missing: log};
};

// Formats that need one of the page's libraries to create - PDF, spreadsheets, DOCX,
// MessagePack and the ffmpeg-made media. Run after __buildFixtures(); each one that cannot
// be made (no network and no --mirror) is simply left out, and the edges that need it are
// reported as not exercised rather than failed.
window.__buildLibFixtures = async function () {
    const F = window.__F, made = [], missing = [];
    const run = async (id, from, to) => {
        const c = converters.find(x => x.id === id);
        if (c.lib) await loadLibrary(c.lib, c.name);
        return await c.convert(F[from], from, to, {...DEFAULT_OPTIONS}, {file: new File([F[from]], 'fixture'), name: 'fixture'});
    };
    const jszip = async () => {
        if (!window.JSZip) await loadLibrary('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
    };
    const makers = {
        'application/pdf': () => run('text-to-pdf', 'text/plain', 'application/pdf'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            () => run('json-to-xlsx', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        'application/vnd.oasis.opendocument.spreadsheet': async () => {
            if (!window.XLSX) await loadLibrary(sjsUrl, 'SheetJS');
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['name', 'age'], ['Ada', 36], ['Bob', 41]]), 'Sheet1');
            return new Blob([XLSX.write(wb, {bookType: 'ods', type: 'array'})]);
        },
        'application/msgpack': () => run('json-to-msgpack', 'application/json', 'application/msgpack'),
        // The smallest DOCX Word and mammoth accept: a heading and a bold run.
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': async () => {
            await jszip();
            const z = new JSZip();
            z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
                + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
            z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
            z.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
                + '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>'
                + '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold</w:t></w:r><w:r><w:t xml:space="preserve"> and plain text.</w:t></w:r></w:p></w:body></w:document>');
            return await z.generateAsync({type: 'blob'});
        },
        'audio/mpeg': () => run('ffmpeg-audio-to-audio', 'audio/wav', 'audio/mpeg'),
        'video/mp4': () => run('ffmpeg-image-to-video', 'image/png', 'video/mp4'),
        'video/webm': () => run('ffmpeg-image-to-video', 'image/png', 'video/webm'),
        // An MP3 with a real ID3v2.3 APIC frame, so album-art extraction has something to find.
        'audio/mpeg+art': async () => {
            const art = new Uint8Array(await F['image/png'].arrayBuffer());
            const te = new TextEncoder();
            const body = [0x00, ...te.encode('image/png'), 0x00, 0x03, 0x00, ...art]; // latin-1, mime, front cover, no description
            const n = body.length;
            const frame = [...te.encode('APIC'), (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, 0, 0, ...body];
            const size = frame.length;   // tag sizes are syncsafe: 7 bits per byte
            const tag = [...te.encode('ID3'), 3, 0, 0, (size >>> 21) & 127, (size >>> 14) & 127, (size >>> 7) & 127, size & 127, ...frame];
            return new Blob([new Uint8Array(tag), F['audio/mpeg']], {type: 'audio/mpeg'});
        }
    };
    // Every other audio and video container, so each one's decoding is exercised as well.
    for (const m of ['audio/ogg', 'audio/webm', 'audio/flac', 'audio/aac', 'audio/opus', 'audio/mp4']) {
        makers[m] = () => run('ffmpeg-audio-to-audio', 'audio/wav', m);
    }
    for (const m of ['video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/mpeg', 'video/3gpp']) {
        makers[m] = () => run('ffmpeg-image-to-video', 'image/png', m);
    }
    for (const [mime, make] of Object.entries(makers)) {
        try {
            const blob = await Promise.race([make(), new Promise((_, rj) => setTimeout(() => rj(new Error('timed out')), 120000))]);
            if (!blob || !blob.size) throw new Error('empty');
            F[mime] = blob;
            made.push(mime);
        } catch (e) {
            missing.push({fixture: mime, error: String((e && e.message) || e).slice(0, 120)});
        }
    }
    return {made, missing};
};
