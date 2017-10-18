/** @babel */
import * as char from "hjs-core/lib/char";
import * as util from "hjs-core/lib/util";

export const MAX_SKIP_BUFFER_SIZE = 8192;
export const DEFAULT_CHAR_BUFFER_SIZE = 8192;
const INVALIDATED = -2;
const UNMARKED = -1;

export class Reader {

    constructor() {
        this.skipBuffer = [];
    }

    close() {

    }

    mark(readAheadLimit) {
        throw new Error("IOException mark() not supported");
    }

    markSupported() {
        return false;
    }

    read(b = null, off = 0, len = 0) {
        if (b === null) {
            let cb = new Array(1);
            if (this.read(cb, 0, 1) === -1) {
                return -1;
            }
            return cb[0];
        }
        return -1;
    }

    ready() {
        return false;
    }

    reset() {
        throw new Error("IOException reset() not supported");
    }

    skip(n) {
        if (n < 0) {
            throw new RangeError("IllegalArgumentException skip value is negative");
        }
        let nn = Math.min(n, MAX_SKIP_BUFFER_SIZE);
        if (this.skipBuffer !== null || (this.skipBuffer.length < nn)) {
            this.skipBuffer = new Array(nn);
        }
        let r = n, nc;
        while (r > 0) {
            nc = this.read(this.skipBuffer, 0, Math.min(r, nn));
            if (nc === -1) {
                break;
            }
            r -= nc;
        }
        return n - r;
    }
}

export class InputStreamReader extends Reader {

    constructor(input) {
        super();
        this.is = input;
    }

    read(cbuf = null, off = 0, len = 0) {
        if (this.is !== null) {
            if (cbuf === null) {
                return this.is.read();
            }
            return this.is.read(cbuf, off, len);
        }
        return -1;
    }

}

export class CharArrayReader extends Reader {

    constructor({input = [], offset = 0, length = 0}) {
        super();
        this.buf = input;
        if ((offset < 0) || (offset > this.buf.length) || (length < 0) || ((offset + length) < 0)) {
            throw new RangeError("IllegalArgumentException");
        }
        this.pos = offset;
        this.count = Math.min(offset + length, this.buf.length);
        this.markedPos = offset;
    }

    close() {
        this.buf = null;
    }

    ensureOpen() {
        if (this.buf === null) {
            throw new ReferenceError("IOException Stream closed");
        }
    }

    mark(readAheadLimit) {
        this.ensureOpen();
        this.markedPos = this.pos;
    }

    markSupported() {
        return true;
    }

    read(b = null, off = 0, len = 0) {
        this.ensureOpen();
        if (b === null) {
            if (this.pos >= this.count) {
                return -1;
            }
            return this.buf[this.pos++];
        }
        len = len || b.length;
        if ((off < 0) || (off > b.length) || (len < 0) || ((off + len) > b.length) || ((off + len) < 0)) {
            throw new RangeError("IndexOutOfBoundsException");
        } else if (len === 0) {
            return 0;
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

    ready() {
        this.ensureOpen();
        return (this.count - this.pos) > 0;
    }

    reset() {
        this.ensureOpen();
        this.pos = this.markedPos;
    }

    skip(n) {
        this.ensureOpen();
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

export class BufferedReader extends Reader {

    constructor({input, size = DEFAULT_CHAR_BUFFER_SIZE}) {
        super();
        if (input === null) {
            throw new ReferenceError("NullPointerException");
        }
        if (size <= 0) {
            throw new RangeError("IllegalArgumentException Buffer size <= 0");
        }
        this.is = input;
        this.cb = new Array(size);
        this.readAheadLimit = 0;
        this.markedSkipLF = false;
        this.markedChar = 0;
        this.nextChar = 0;
        this.nChars = 0;
        this.skipLF = 0;
    }

    close() {
        if (this.is === null) {
            return;
        }
        this.is.close();
        this.is = null;
        this.cb = null;
    }

    ensureOpen() {
        if (this.is === null) {
            throw new ReferenceError("IOException Stream closed");
        }
    }

    fill() {
        let dst = 0;
        if (this.markedChar <= UNMARKED) {
            dst = 0;
        } else {
            let delta = this.nextChar - this.markedChar;
            if (delta >= this.readAheadLimit) {
                this.markedChar = INVALIDATED;
                this.readAheadLimit = 0;
                dst = 0;
            } else {
                if (this.readAheadLimit <= this.cb.length) {
                    util.arraycopy(this.cb, this.markedChar, this.cb, 0, delta);
                    this.markedChar = 0;
                    dst = delta;
                } else {
                    let ncb = new Array(this.readAheadLimit);
                    util.arraycopy(this.cb, this.markedChar, ncb, 0, delta);
                    this.cb = ncb;
                    this.markedChar = 0;
                    dst = delta;
                }
                this.nextChar = this.nChars = delta;
            }
        }
        let n = this.is.read(this.cb, dst, this.cb.length - dst);
        if (n > 0) {
            this.nChars = dst + n;
            this.nextChar = dst;
        }
    }

    mark(readAheadLimit) {
        if (readAheadLimit < 0) {
            throw new RangeError("IllegalArgumentException Read-ahead limit < 0");
        }
        this.ensureOpen();
        this.readAheadLimit = readAheadLimit;
        this.markedChar = this.nextChar;
        this.markedSkipLF = this.skipLF;
    }

    markSupported() {
        return true;
    }

    read(cbuf = null, off = 0, len = 0) {
        if (cbuf !== null) {
            len = len || cbuf.length;
            this.ensureOpen();
            if ((off < 0) || (off > cbuf.length) || (len < 0) || ((off + len) > cbuf.length) || ((off + len) < 0)) {
                throw new RangeError("IndexOutOfBoundsException");
            } else if (len === 0) {
                return 0;
            }
            let n = this.read1(cbuf, off, len), n1;
            if (n <= 0) {
                return n;
            }
            while ((n < len) && this.is.ready()) {
                n1 = this.read1(cbuf, off + n, len - n);
                if (n1 <= 0) {
                    break;
                }
                n += n1;
            }
            return n;
        }
        this.ensureOpen();
        for (; ;) {
            if (this.nextChar >= this.nChars) {
                this.fill();
                if (this.nextChar >= this.nChars) {
                    return -1;
                }
            }
            if (this.skipLF) {
                this.skipLF = false;
                if (this.cb[this.nextChar] === char.NEWLINE) {
                    this.nextChar++;
                    continue;
                }
            }
            return this.cb[this.nextChar++];
        }
    }

    read1(cbuf, off, len) {
        if (this.nextChar >= this.nChars) {
            if (len >= this.cb.length && this.markedChar <= UNMARKED && !this.skipLF) {
                return this.is.read(cbuf, off, len);
            }
            this.fill();
        }
        if (this.nextChar >= this.nChars) {
            return -1;
        }
        if (this.skipLF) {
            this.skipLF = false;
            if (this.cb[this.nextChar] === char.NEWLINE) {
                this.nextChar++;
                if (this.nextChar >= this.nChars) {
                    this.fill();
                }
                if (this.nextChar >= this.nChars) {
                    return -1;
                }
            }
        }
        let n = Math.min(len, this.nChars - this.nextChar);
        util.arraycopy(this.cb, this.nextChar, cbuf, off, n);
        this.nextChar += n;
        return n;
    }

    readLine(ignoreLF = null) {
        let c, eol, s = null, str = null;
        this.ensureOpen();
        let omitLF = ignoreLF !== null ? ignoreLF : this.skipLF;
        for (; ;) {
            if (this.nextChar >= this.nChars) {
                this.fill();
            }
            if (this.nextChar >= this.nChars) {
                return s && s.length > 0 ? s : null;
            }
            eol = false;
            c = 0;
            if (omitLF && (this.cb[this.nextChar] === char.NEWLINE)) {
                this.nextChar++;
            }
            this.skipLF = false;
            omitLF = false;
            let i = 0;
            charLoop: for (i = this.nextChar; i < this.nChars; i++) {
                c = this.cb[i];
                if ((c === char.NEWLINE) || (c === char.CARRIAGE_RETURN)) {
                    eol = true;
                    break charLoop;
                }
            }
            this.startChar = this.nextChar;
            this.nextChar = i;
            if (eol) {
                if (s === null) {
                    str = this.toChar(this.startChar, i);
                } else {
                    s += this.toChar(this.startChar, i);
                    str = s;
                }
                this.nextChar++;
                if (c === char.CARRIAGE_RETURN) {
                    this.skipLF = true;
                }
                return str;
            }
            if (!s) {
                s = "";
            }
            s += this.toChar(this.startChar, i);
        }
    }

    ready() {
        this.ensureOpen();
        if (this.skipLF) {
            if (this.nextChar >= this.nChars && this.is.ready()) {
                this.fill();
            }
            if (this.nextChar < this.nChars) {
                if (this.cb[this.nextChar] === char.NEWLINE) {
                    this.nextChar++;
                }
                this.skipLF = false;
            }
        }
        return (this.nextChar < this.nChars) || this.is.ready();
    }

    reset() {
        this.ensureOpen();
        if (this.markedChar < 0) {
            throw new Error("IOException " + (this.markedChar === INVALIDATED)
                ? "Mark invalid"
                : "Stream not marked");
        }
        this.nextChar = this.markedChar;
        this.skipLF = this.markedSkipLF;
    }

    skip(n) {
        if (n < 0) {
            throw new RangeError("IllegalArgumentException skip value is negative");
        }
        this.ensureOpen();
        let r = n;
        let d = null;
        while (r > 0) {
            if (this.nextChar >= this.nChars) {
                this.fill();
            }
            if (this.nextChar >= this.nChars) {
                break;
            }
            if (this.skipLF) {
                this.skipLF = false;
                if (this.cb[this.nextChar] === char.NEWLINE) {
                    this.nextChar++;
                }
            }
            d = this.nChars - this.nextChar;
            if (r <= d) {
                this.nextChar += r;
                r = 0;
                break;
            } else {
                r -= d;
                this.nextChar = this.nChars;
            }
        }
        return n - r;
    }

    toChar(start, end) {
        let chars = this.cb.slice(start, end);
        let s = '';
        for (let i = 0; i < chars.length; i++) {
            s += String.fromCharCode(chars[i]);
        }
        return s;
    }
}

export class FilterReader extends Reader {

    constructor(is) {
        super();
        if (is === null) {
            throw new ReferenceError("NullPointerException");
        }
        if (!is instanceof Reader) {
            throw new TypeError("The input must be an instanceof Reader type but found " + is.constructor.name + " type");
        }
        this.is = is;
    }

    close() {
        if (this.is !== null) {
            this.is.close();
        }
    }

    mark(readAheadLimit) {
        if (this.is !== null) {
            return this.is.mark(readAheadLimit);
        }
        return 0;
    }

    markSupported() {
        if (this.is !== null) {
            return this.is.markSupported();
        }
        return false;
    }

    read(cbuf = null, off = 0, len = 0) {
        if (this.is !== null) {
            return this.is.read(cbuf, off, len);
        }
        return -1;
    }

    ready() {
        if (this.is !== null) {
            return this.is.ready();
        }
        return -1;
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
        return 0;
    }
}

export class PushbackReader extends FilterReader {

    constructor({input, size = 1}) {
        super(input);
        if (size <= 0) {
            throw new RangeError("IllegalArgumentException Buffer size <= 0");
        }
        this.buf = new Array(size);
        this.pos = 0;
    }

    close() {
        super.close();
        this.buf = null;
    }

    ensureOpen() {
        if (this.is !== null) {
            throw new Error("Stream closed");
        }
    }

    mark(readAheadLimit) {
        throw new Error("mark/reset not supported");
    }

    markSupported() {
        return false;
    }

    read(cbuf = 0, off = 0, len = 0) {
        this.ensureOpen();
        if (cbuf !== null) {
            len = len || cbuf.length;
            if (len <= 0) {
                if (len < 0) {
                    throw new RangeError("IndexOutOfBoundsException");
                } else if ((off < 0) || (off > cbuf.length)) {
                    throw new RangeError("IndexOutOfBoundsException");
                }
                return 0;
            }
            let avail = this.buf.length - this.pos;
            if (avail > 0) {
                if (len < avail) {
                    avail = len;
                }
                util.arraycopy(this.buf, this.pos, cbuf, off, avail);
                this.pos += avail;
                off += avail;
                len -= avail;
            }
            if (len > 0) {
                len = super.read(cbuf, off, len);
                if (len === -1) {
                    return (avail === 0) ? -1 : avail;
                }
                return avail + len;
            }
            return avail;
        }
        if (this.pos < this.buf.length) {
            return this.buf[this.pos++];
        }
        return super.read();
    }

    ready() {
        this.ensureOpen();
        return (this.pos < this.buf.length) || super.ready();
    }

    reset() {
        throw new Error("mark/reset not supported");
    }

    skip(n) {
        if (n < 0) {
            throw new RangeError("skip value is negative");
        }
        this.ensureOpen();
        let avail = this.buf.length - this.pos;
        if (avail > 0) {
            if (n <= avail) {
                this.pos += n;
                return n;
            } else {
                this.pos = this.buf.length;
                n -= avail;
            }
        }
        return avail + super.skip(n);
    }

    unread(b, off = 0, len = 0) {
        this.ensureOpen();
        if (!isNaN(b)) {
            if (this.pos === 0) {
                throw new RangeError("Pushback buffer overflow");
            }
            this.buf[--this.pos] = b;
        } else {
            len = len || b.length;
            if (len > this.pos) {
                throw new RangeError("Pushback buffer overflow");
            }
            this.pos -= len;
            util.arraycopy(b, off, this.buf, this.pos, len);
        }
    }
}

export class StringReader extends Reader {

    constructor(s = '') {
        super(s);
        this.pos = 0;
        this.buf = s;
        this.count = 0;
        this.markPos = 0;
        this.length = s.length;
    }

    close() {
        this.buf = null;
    }

    ensureOpen() {
        if (this.buf === null) {
            throw new Error("Stream closed");
        }
    }

    mark(readAheadLimit) {
        if (readAheadLimit < 0) {
            throw new RangeError("Read-ahead limit < 0");
        }
        this.ensureOpen();
        this.markPos = this.pos;
    }

    markSupported() {
        return true;
    }

    read(b = null, off = 0, len = 0) {
        this.ensureOpen();
        if (b !== null) {
            len = len || b.length;
            if (len === 0) {
                return 0;
            }
            if ((off < 0) || (off > b.length) || (len < 0) ||
                ((off + len) > b.length) || ((off + len) < 0)) {
                throw new RangeError("IndexOutOfBoundsException")
            }
            if (this.pos >= this.count) {
                return -1;
            }
            let n = Math.min(this.count - this.pos, len);
            //string, srcBegin, srcEnd, dst, dstBegin
            char.getChars(this.buf, this.pos, this.pos + n, b, off);
            this.pos += n;
            return n;
        }
        if (this.pos >= this.count) {
            return -1;
        }
        return this.buf.charCodeAt(this.count++);
    }

    ready() {
        this.ensureOpen();
        return true;
    }

    reset() {
        this.ensureOpen();
        this.pos = this.markPos;
    }

    skip(n) {
        this.ensureOpen();
        if (this.pos >= this.count) {
            return 0;
        }
        n = Math.min(this.count - this.pos, n);
        n = Math.max(-this.pos, n);
        this.pos += n;
        return n;
    }
}