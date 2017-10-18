/** @babel */
import * as util from "hjs-core/lib/util";

let skipBuffer = null;

export const SKIP_BUFFER_SIZE = 2048;
export const DEFAULT_BUFFER_SIZE = 8192;

export class InputStream {

    constructor() {

    }

    available() {
        return 0;
    }

    close() {
    }

    mark(readlimit) {
    }

    markSupported() {
        return false;
    }

    read(b = null, off = 0, len = 0) {
        if (b !== null) {
            off = off || 0;
            len = len || b.length;
            if (off < 0 || len < 0 || len > b.length - off) {
                throw new RangeError("IndexOutOfBoundsException");
            } else if (len === 0) {
                return 0;
            }
            let c = this.read();
            if (c === -1) {
                return -1;
            }
            b[off] = c;
            let i = 1;
            try {
                for (; i < len; i++) {
                    c = this.read();
                    if (c === -1) {
                        break;
                    }
                    b[off + i] = c;
                }
            } catch (e) {

            }
            return i;
        }
        return -1;
    }

    reset() {
        throw new RangeError("IOException mark/reset not supported");
    }

    skip(n) {
        let remaining = n;
        let nr;
        if (skipBuffer === null) {
            skipBuffer = new Array(SKIP_BUFFER_SIZE);
        }
        let localSkipBuffer = skipBuffer;
        if (n <= 0) {
            return 0;
        }
        while (remaining > 0) {
            nr = this.read(localSkipBuffer, 0, Math.min(SKIP_BUFFER_SIZE, remaining));
            if (nr < 0) {
                break;
            }
            remaining -= nr;
        }
        return n - remaining;
    }
}

export class ByteArrayInputStream extends InputStream {

    constructor({input = [], offset = 0, length = 0} = {}) {
        super();
        this.buf = input;
        if (offset > 0 && length > 0) {
            this.pos = this.mark = offset;
            this.count = Math.min(offset + length, this.buf.length);
        } else {
            this.count = this.buf.length;
            this.pos = 0;
        }
    }

    available() {
        return this.count - this.pos;
    }

    close() {

    }

    mark(readAheadLimit) {
        this.markPos = this.pos;
    }

    markSupported() {
        return true;
    }

    read(b = null, off = 0, len = 0) {
        if (b) {
            len = len || b.length;
            if (off < 0 || len < 0 || len > b.length - off) {
                throw new RangeError("IndexOutOfBoundsException");
            }
            if (this.pos >= this.count) {
                return -1;
            }
            if (this.pos + len > this.count) {
                len = this.count - this.pos;
            }
            if (len <= 0) {
                return 0;
            }
            util.arraycopy(this.buf, this.pos, b, off, len);
            this.pos += len;
            return len;
        }
        return (this.pos < this.count) ? (this.buf[this.pos++] & 0xff) : -1;
    }

    reset() {
        this.pos = this.markPos;
    }

    skip(n) {
        if (this.pos + n > this.count) {
            n = this.count - this.pos;
        }
        if (n < 0) {
            return 0;
        }
        this.pos += n;
        return n;
    }
}

export class FilterInputStream extends InputStream {

    constructor(is) {
        super();
        this.is = is;
    }

    available() {
        if (this.is !== null) {
            return this.is.available();
        }
        return super.available();
    }

    close() {
        if (this.is !== null) {
            this.is.close();
        }
    }

    mark(readlimit) {
        if (this.is !== null) {
            this.is.mark(readlimit);
        } else {
            super.mark();
        }
    }

    markSupported() {
        if (this.is !== null) {
            return this.is.markSupported();
        }
        return super.markSupported();
    }

    read(b = null, off = 0, len = 0) {
        if (this.is !== null) {
            return this.is.read(b, off, len);
        }
        return super.read(b, off, len);
    }

    reset() {
        if (this.is !== null) {
            this.is.reset();
        }
    }

    skip(n) {
        if (this.is !== null) {
            return this.is.skip(n);
        }
        return super.skip(n);
    }

}

export class BufferedInputStream extends FilterInputStream {

    constructor({input, size = DEFAULT_BUFFER_SIZE}) {
        super(input);
        if (size <= 0) {
            throw new RangeError("IllegalArgumentException Buffer size <= 0");
        }
        this.buf = new Array(size);
        this.marklimit = 0;
        this.markpos = 0;
        this.count = 0;
        this.pos = 0;
    }

    available() {
        return this.getInIfOpen().available() + (this.count - this.pos);
    }

    close() {
        let input = this.is;
        this.is = null;
        if (input !== null) {
            input.close();
        }
    }

    fill() {
        let buffer = this.getBufIfOpen();
        if (this.markpos < 0) {
            this.pos = 0;
        } else if (this.pos >= this.buffer.length) {
            if (this.markpos > 0) {
                let sz = this.pos - this.markpos;
                util.arraycopy(buffer, this.markpos, buffer, 0, sz);
                this.pos = sz;
                this.markpos = 0;
            } else if (buffer.length >= this.marklimit) {
                this.markpos = -1;
                this.pos = 0;
            } else {
                let nsz = this.pos * 2;
                if (nsz > this.marklimit) {
                    nsz = this.marklimit;
                }
                let nbuf = new Array(nsz);
                util.arraycopy(buffer, 0, nbuf, 0, this.pos);
                buffer = nbuf;
            }
            this.count = this.pos;
        }
        let n = this.getInIfOpen().read(buffer, this.pos, buffer.length - this.pos);
        if (n > 0) {
            this.count = n + this.pos;
        }
    }

    getBufIfOpen() {
        let buffer = this.buf;
        if (buffer === null) {
            throw new ReferenceError("IOException Stream closed");
        }
        return buffer;
    }

    getInIfOpen() {
        let input = this.is;
        if (input === null) {
            throw new ReferenceError("IOException Stream closed");
        }
        return input;
    }

    mark(readlimit) {
        this.marklimit = readlimit;
        this.markpos = this.pos;
    }

    markSupported() {
        return true;
    }

    read(b = null, off = 0, len = 0) {
        if (b !== null) {
            this.getBufIfOpen();
            len = len || b.length;
            if ((off | len | (off + len) | (b.length - (off + len))) < 0) {
                throw new RangeError("throw new IndexOutOfBoundsException();");
            } else if (len === 0) {
                return 0;
            }
            let n = 0, input, nread;
            for (; ;) {
                nread = this.read1(b, off + n, len - n);
                if (nread <= 0) {
                    return (n === 0) ? nread : n;
                }
                n += nread;
                if (n >= len) {
                    return n;
                }
                input = this.is;
                if (input !== null && input.available() <= 0) {
                    return n;
                }
            }
        }
        if (this.pos >= this.count) {
            this.fill();
            if (this.pos >= this.count) {
                return -1;
            }
        }
        return this.getBufIfOpen()[this.pos++] & 0xff;
    }

    read1(b, off, len) {
        let avail = this.count - this.pos;
        if (avail <= 0) {
            if (len >= this.getBufIfOpen().length && this.markpos < 0) {
                return this.getInIfOpen().read(b, off, len);
            }
            this.fill();
            avail = this.count - this.pos;
            if (avail <= 0) {
                return -1;
            }
        }
        let cnt = (avail < len) ? avail : len;
        let arr = this.getBufIfOpen();
        util.arraycopy(arr, this.pos, b, off, cnt);
        this.pos += cnt;
        return cnt;
    }

    reset() {
        this.getBufIfOpen();
        if (this.markpos < 0) {
            throw new RangeError("IOException Resetting to invalid mark");
        }
        this.pos = this.markpos;
    }

    skip(n) {
        this.getBufIfOpen();
        if (n <= 0) {
            return 0;
        }
        let avail = this.count - this.pos;
        if (avail <= 0) {
            if (this.markpos < 0) {
                return this.getInIfOpen().skip(n);
            }
            this.fill();
            avail = this.count - this.pos;
            if (avail <= 0) {
                return 0;
            }
        }
        let skipped = (avail < n) ? avail : n;
        this.pos += skipped;
        return skipped;
    }
}

export class PushbackInputStream extends FilterInputStream {

    constructor({input, size = 1}) {
        super(input);
        if (size <= 0) {
            throw new RangeError("IllegalArgumentException Buffer size <= 0");
        }
        this.buf = new Array(size);
        this.pos = 0;
    }

    available() {
        this.ensureOpen();
        let n = this.buf.length - this.pos;
        let avail = super.available();
        return n > (Number.MAX_VALUE - avail) ? Number.MAX_VALUE : n + avail;
    }

    close() {
        if (this.is === null) {
            return;
        }
        this.is.close();
        this.is = null;
        this.buf = null;
    }

    ensureOpen() {
        if (this.is === null) {
            throw new ReferenceError("Stream closed");
        }
    }

    mark(readlimit) {

    }

    markSupported() {
        return false;
    }

    read(b = null, off = 0, len = 0) {
        this.ensureOpen();
        if (b !== null) {
            len = len || b.length;
            if (off < 0 || len < 0 || len > b.length - off) {
                throw new RangeError("IndexOutOfBoundsException");
            }
            let avail = this.buf.length - this.pos;
            if (avail > 0) {
                if (len < avail) {
                    avail = len;
                }
                util.arraycopy(this.buf, this.pos, b, off, avail);
                this.pos += avail;
                off += avail;
                len -= avail;
            }
            if (len > 0) {
                len = super.read(b, off, len);
                if (len === -1) {
                    return avail === 0 ? -1 : avail;
                }
                return avail + len;
            }
            return avail;
        }
        if (this.pos < this.buf.length) {
            return this.buf[this.pos++] & 0xff;
        }
        return super.read();
    }

    reset() {
        throw new Error("mark/reset not supported");
    }

    skip(n) {
        this.ensureOpen();
        if (n <= 0) {
            return 0;
        }
        let pskip = this.buf.length - this.pos;
        if (pskip > 0) {
            if (n < pskip) {
                pskip = n;
            }
            this.pos += pskip;
            n -= pskip;
        }
        if (n > 0) {
            pskip += super.skip(n);
        }
        return pskip;
    }

    unread(b, off = 0, len = 0) {
        this.ensureOpen();
        if (!isNaN(b)) {
            if (this.pos === 0) {
                throw new RangeError("Push back buffer is full");
            }
            this.buf[--this.pos] = b;
        } else {
            len = len || b.length;
            if (len > this.pos) {
                throw new RangeError("Push back buffer is full");
            }
            this.pos -= len;
            util.arraycopy(b, off, this.buf, this.pos, len);
        }
    }
}

export class StringBufferInputStream extends InputStream {

    constructor(s = '') {
        super();
        this.pos = 0;
        this.buf = s;
        this.count = s.length;
    }

    available() {
        return this.count - this.pos;
    }

    read(b = null, off = 0, len = 0) {
        if (b !== null) {
            len = len || b.length;
            if ((off < 0) || (off > b.length) || (len < 0) || ((off + len) > b.length) || ((off + len) < 0)) {
                throw new RangeError("IndexOutOfBoundsException");
            }
            if (this.pos >= this.count) {
                return -1;
            }
            if (this.pos + len > this.count) {
                len = this.count - this.pos;
            }
            if (len <= 0) {
                return 0;
            }
            let s = this.buf;
            let cnt = len;
            while (--cnt >= 0) {
                b[off++] = s.charCodeAt(this.pos++);
            }
            return len;
        }
        return (this.pos < this.count) ? (this.buf.charCodeAt(this.pos++) & 0xFF) : -1;
    }

    reset() {
        this.pos = 0;
    }

    skip(n) {
        if (n < 0) {
            return 0;
        }
        if (n > this.count - this.pos) {
            n = this.count - this.pos;
        }
        this.pos += n;
        return n;
    }
}

export class SequenceInputStream extends InputStream {

    constructor({enumeration = null, s1 = null, s2 = null} = {}) {
        super();
        if (enumeration === null && (s1 === null || s2 === null)) {
            throw new ReferenceError('IllegalArgumentsException');
        }
        this.is = null;
        if (enumeration !== null) {
            this.e = enumeration;
        } else {
            enumeration.cursor = 0;
            enumeration.list = [s1, s2];
            enumeration = {
                destroy: () => {
                    this.list = this.cursor = null;
                },
                hasMoreElements: () => {
                    return this.cursor >= 0 && this.cursor < this.list.length;
                },
                nextElement: () => {
                    let el = this.list[this.cursor];
                    this.cursor++;
                    if (this.cursor === this.list.length) {
                        this.destroy();
                    }
                    return el;
                }
            };
            this.e = enumeration;
        }
        try {
            this.nextStream();
        } catch (e) {
            throw new Error("panic " + e.message);
        }
    }

    available() {
        if (this.is === null) {
            return 0;
        }
        return this.is.available();
    }

    close() {
        do {
            this.nextStream();
        } while (this.is !== null);
    }

    nextStream() {
        if (this.is !== null) {
            this.is.close();
        }
        if (this.e.hasMoreElements()) {
            this.is = this.e.nextElement();
            if (this.is === null) {
                throw new ReferenceError('NullPointerException');
            }
        } else {
            this.is = null;
        }
    }

    read(b = null, off = 0, len = 0) {
        if (b !== null) {
            if (this.is === null) {
                return -1;
            }
            off = off || 0;
            len = len || b.length;
            if (off < 0 || len < 0 || len > b.length - off) {
                throw new RangeError("IndexOutOfBoundsException");
            } else if (len === 0) {
                return 0;
            }
            let n = this.is.read(b, off, len);
            if (n <= 0) {
                this.nextStream();
                return this.read(b, off, len);
            }
            return n;
        }
        if (this.is === null) {
            return -1;
        }
        let c = this.is.read();
        if (c === -1) {
            this.nextStream();
            return this.read();
        }
        return c;
    }

}
