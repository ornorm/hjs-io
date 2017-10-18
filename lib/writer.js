/** @babel */
import * as char from "hjs-core/lib/char";

export const WRITE_BUFFER_SIZE = 1024;

export class Writer {

    constructor() {
        this.writeBuffer = null;
    }

    close() {

    }

    flush() {

    }

    write(cbuf, off = 0, len = 0) {
        if (Array.isArray(cbuf)) {
            this.writeBuffer(cbuf, off, len);
        } else {
            if (typeof cbuf === 'number') {
                if (this.writeBuffer === null) {
                    this.writeBuffer = new Array(WRITE_BUFFER_SIZE);
                }
                this.writeBuffer[0] = cbuf;
                this.write(this.writeBuffer, 0, 1);
            } else if (typeof cbuf === 'string') {
                let str = cbuf;
                if (len === 0) {
                    len = str.length;
                }
                if (len <= WRITE_BUFFER_SIZE) {
                    if (this.writeBuffer === null) {
                        this.writeBuffer = new Array(WRITE_BUFFER_SIZE);
                    }
                    cbuf = this.writeBuffer;
                } else {
                    cbuf = new Array(len);
                }
                char.getChars(str, off, (off + len), cbuf, 0);
                this.write(cbuf, 0, len);
            }
        }
    }

    writeBuffer(cbuf = [], off = 0, len = 0) {

    }

}

export class StringBufferWriter extends Writer {

    constructor({initialSize = 0} = {}) {
        super();
        if (initialSize < 0) {
            throw new RangeError("IllegalArgumentException Negative buffer size");
        }
        this.buf = new StringBuffer(initialSize);
    }

    getBuffer() {
        return this.buf;
    }


    toString() {
        return this.buf.toString();
    }

    write(cbuf, off = 0, len = 0) {
        if (Array.isArray(cbuf)) {
            this.writeBuffer(cbuf, off, len);
        } else {
            if (typeof cbuf === 'number') {
                this.buf.append(String.fromCharCode(cbuf));
            } else if (typeof cbuf === 'string') {
                let str = cbuf;
                if (len === 0) {
                    len = str.length;
                }
                this.buf.append(str.substring(off, off + len));
            }
        }
    }

    writeBuffer(cbuf = [], off = 0, len = 0) {
        if ((off < 0) || (off > cbuf.length) || (len < 0) ||
            ((off + len) > cbuf.length) || ((off + len) < 0)) {
            throw new RangeError('IndexOutOfBoundsException');
        } else if (len === 0) {
            return;
        }
        this.buf.append(cbuf, off, len);
    }

}

export class StringWriter extends Writer {

    constructor() {
        super();
        this.buf = '';
    }

    getBuffer() {
        return this.buf;
    }


    toString() {
        return this.getBuffer();
    }

    write(cbuf, off = 0, len = 0) {
        if (Array.isArray(cbuf)) {
            this.writeBuffer(cbuf, off, len);
        } else {
            if (typeof cbuf === 'number') {
                this.buf += String.fromCharCode(cbuf);
            } else if (typeof cbuf === 'string') {
                let str = cbuf;
                if (len === 0) {
                    len = str.length;
                }
                this.buf += str.substring(off, off + len);
            }
        }
    }

    writeBuffer(cbuf = [], off = 0, len = 0) {
        if ((off < 0) || (off > cbuf.length) || (len < 0) ||
            ((off + len) > cbuf.length) || ((off + len) < 0)) {
            throw new RangeError('IndexOutOfBoundsException');
        } else if (len === 0) {
            return;
        }
        this.buf += char.charBufferToString(cbuf, off, len);
    }

}
