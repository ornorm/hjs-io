/** @babel */
import * as util from "../../hjs-core/lib/util";
import * as char from "../../hjs-core/lib/char";

export class ByteBuffer {

    constructor({buffer, mark = -1, position = 0, limit = 0, capacity = 0, offset = 0} = {}) {
        if (capacity < 0) {
            throw new RangeError('Negative capacity: ' + capacity);
        }
        if (limit === 0) {
            limit = capacity;
        }
        this.hb = buffer;
        this.cap = capacity;
        this.limit(limit);
        this.position(position);
        if (mark >= 0) {
            if (mark > position) {
                throw new RangeError('mark > position: (' + mark + ' > ' + position + ')');
            }
            this.mar = mark;
        }
        this.off = offset;
    }

    static allocate({type = Uint8Array, capacity = 0} = {}) {
        return new ByteBuffer({
            buffer: ByteBuffer.createBuffer({type, capacity}),
            capacity
        });
    }

    array() {
        return this.hb;
    }

    arrayOffset() {
        if (this.hb === null) {
            throw new ReferenceError('UnsupportedOperationException');
        }
        return this.off;
    }

    capacity() {
        return this.cap;
    }

    static checkBounds(off = 0, len = 0, size = 0) {
        if ((off | len | (off + len) | (size - (off + len))) < 0) {
            throw new RangeError('IndexOutOfBoundsException');
        }
    }

    checkIndex(i, nb = null) {
        if (nb !== null) {
            if ((i < 0) || (nb > this.lim - i)) {
                throw new RangeError('IndexOutOfBoundsException');
            }
        } else {
            if ((i < 0) || (i >= this.lim)) {
                throw new RangeError('IndexOutOfBoundsException');
            }
        }
        return i;
    }

    clear() {
        this.pos = 0;
        this.lim = this.cap;
        this.mar = -1;
        return this;
    }

    static createBuffer({type = Uint8Array, capacity = 0, buffer = null} = {}) {
        return new type(buffer === null ? new ArrayBuffer(capacity) : buffer);
    }

    compact() {

        let pos = this.position();
        let lim = this.limit();
        let rem = (pos <= lim ? lim - pos : 0);
        /*
         let db = this.duplicate();

         db.limit(lim);
         db.position(0);

         let sb = db.slice();
         sb.position(pos);
         */
        this.position(rem);
        this.limit(this.capacity());
        this.discardMark();

        return this;
    }

    discardMark() {
        this.mar = -1;
    }

    duplicate() {
        return new ByteBuffer({
            buffer: new this.hb.constructor(this.hb.buffer.slice()),
            mark: this.mar,
            position: this.pos,
            limit: this.lim,
            capacity: this.cap,
            offset: this.off
        });
    }

    flip() {
        this.lim = this.pos;
        this.pos = 0;
        this.mar = -1;
        return this;
    }

    ix(i) {
        return (i << 1) + this.off;
    }

    get(i = null, offset = 0, length = 0) {
        if (i && (Array.isArray(i) || i.hasOwnProperty('length'))) {
            if (length === 0) {
                length = i.length;
            }
            ByteBuffer.checkBounds(offset, length, i.length);
            if (length > this.remaining()) {
                throw new new RangeError('BufferUnderflowException');
            }
            let end = offset + length;
            for (let j = offset; j < end; i++) {
                i[j] = this.get();
            }
            return this;
        } else {
            /*let idx = i === null ? this.ix(this.nextGetIndex()) : this.ix(this.checkIndex(i));*/
            let p = this.pos;
            this.nextGetIndex();
            return this.hb[p];
        }
    }

    getUnchecked(i) {
        let idx = this.ix(i);
        return this.hb[idx];
    }

    hasArray() {
        return (this.hb !== null);
    }

    hasRemaining() {
        return this.pos < this.lim;
    }

    limit(newLimit = null) {
        if (newLimit !== null) {
            if ((newLimit > this.cap) || (newLimit < 0)) {
                throw new RangeError('IllegalArgumentException Negative limit: ' + newLimit);
            }
            this.lim = newLimit;
            if (this.pos > this.lim) {
                this.pos = this.lim;
            }
            if (this.mar > this.lim) {
                this.mar = -1;
            }
            return this;
        }
        return this.lim;
    }

    mark() {
        this.mar = this.pos;
        return this;
    }

    markValue() {
        return this.mar;
    }

    nextGetIndex(nb = null) {
        if (nb !== null) {
            if (this.lim - this.pos < nb) {
                throw new new RangeError('BufferUnderflowException');
            }
            let p = this.pos;
            this.pos += nb;
            return p;
        }
        if (this.pos >= this.lim) {
            throw new new RangeError('BufferUnderflowException');
        }
        return this.pos++;
    }

    nextPutIndex(nb = null) {
        if (nb !== null) {
            if (this.lim - this.pos < nb) {
                throw new new RangeError('BufferUnderflowException');
            }
            let p = this.pos;
            this.pos += nb;
            return p;
        }
        if (this.pos >= this.lim) {
            throw new RangeError('BufferUnderflowException');
        }
        return this.pos++;
    }

    position(newPosition = null) {
        if (newPosition !== null) {
            if ((newPosition > this.lim) || (newPosition < 0)) {
                throw new RangeError('IllegalArgumentException Negative position: ' + newPosition);
            }
            this.pos = newPosition;
            if (this.mar > this.pos) {
                this.mar = -1;
            }
            return this;
        }
        return this.pos;
    }

    put(b, index = null, length = 0) {
        if (b instanceof ByteBuffer) {
            if (b === this) {
                throw new ReferenceError('IllegalArgumentException');
            }
            let n = b.remaining();
            if (n > this.remaining()) {
                throw new RangeError('BufferUnderflowException');
            }
            for (let i = 0; i < n; i++) {
                this.put(b.get());
            }
        } else if (b && (Array.isArray(b) || b.hasOwnProperty('length'))) {
            if (length === 0) {
                length = b.length;
            }
            ByteBuffer.checkBounds(index, length, b.length);
            if (length > this.remaining()) {
                throw new RangeError('BufferUnderflowException');
            }
            let end = index + length;
            for (let i = index; i < end; i++) {
                this.put(b[i]);
            }
        } else {
            if (index === null) {
                let p = this.pos;
                this.nextPutIndex();
                this.hb[p] = b;
            } else {
                this.checkIndex(index);
                this.nextPutIndex(this.lim - index);
                this.hb[index] = b;
            }
        }
        return this;
    }

    remaining() {
        return this.lim - this.pos;
    }

    reset() {
        let m = this.mar;
        if (m < 0) {
            throw new RangeError('InvalidMarkException');
        }
        this.pos = m;
        return this;
    }

    rewind() {
        this.pos = 0;
        this.mar = -1;
        return this;
    }

    slice() {
        let pos = this.position();
        let lim = this.limit();
        let rem = (pos <= lim ? lim - pos : 0);
        let off = (pos << 1) + this.off;
        return new ByteBuffer({
            buffer: new this.hb.constructor(this.hb.buffer.slice(0, rem)),
            mark: -1,
            position: 0,
            limit: rem,
            capacity: rem,
            offset: off
        });
    }

    toString() {
        let sb = '';
        sb += '[pos=' + this.pos;
        sb += ' lim=' + this.lim;
        sb += ' cap=' + this.cap;
        sb += ']';
        return sb;
    }

    truncate() {
        this.mar = -1;
        this.pos = 0;
        this.lim = 0;
        this.cap = 0;
    }

    static wrap({buffer = null, capacity = 0} = null) {
        return new ByteBuffer({
            buffer: buffer,
            capacity
        });
    }

}

export class StringBuffer {

    constructor({capacity = 16} = {}) {
        this.value = new Array(capacity);
        this.count = 0;
    }

    append(v = null, offset = 0, len = 0) {
        if (v === null) {
            return this.appendNull();
        }
        let n = 0;
        if (v instanceof StringBuffer) {
            let asb = v;
            n = asb.length();
            this.ensureCapacityInternal(this.count + n);
            asb.getChars(0, n, this.value, this.count);
            this.count += n;
        } else if (typeof v === 'string') {
            let str = v;
            n = str.length;
            this.ensureCapacityInternal(this.count + n);
            char.getChars(str, 0, n, this.value, this.count);
        } else if (typeof v === 'number') {
            let c = v;
            this.ensureCapacityInternal(this.count + 1);
            this.value[this.count++] = c;
        } else if (typeof v === 'boolean') {
            if (v) {
                this.ensureCapacityInternal(count + 4);
                this.value[this.count++] = char.t;
                this.value[this.count++] = char.r;
                this.value[this.count++] = char.u;
                this.value[this.count++] = char.e;
            } else {
                this.ensureCapacityInternal(this.count + 5);
                this.value[count++] = char.f;
                this.value[count++] = char.a;
                this.value[count++] = char.l;
                this.value[count++] = char.s;
                this.value[count++] = char.e;
            }
        } else if (v.constructor === Object) {
            try {
                return this.append(JSON.stringify(v));
            } catch (e) {
                return this.append(v.toString());
            }
        } else if (Array.isArray(v)) {
            let arr = v;
            if (len === 0) {
                len = arr.length;
            }
            if (len > 0) {
                this.ensureCapacityInternal(this.count + len);
            }
            util.arraycopy(arr, offset, this.value, this.count, len);
            n = len;
        }
        this.count += n;
        return this;
    }

    appendNull() {
        let c = this.count;
        this.ensureCapacityInternal(c + 4);
        let value = this.value;
        value[c++] = 'n';
        value[c++] = 'u';
        value[c++] = 'l';
        value[c++] = 'l';
        this.count = c;
        return this;
    }

    capacity(index) {
        return this.value.length;
    }

    charAt(index) {
        if ((index < 0) || (index >= count)) {
            throw new RangeError('StringIndexOutOfBoundsException ' + index);
        }
        return this.value[index];
    }

    deleteCharAt(index = 0) {
        if ((index < 0) || (index >= this.count)) {
            throw new RangeError('StringIndexOutOfBoundsException ' + index);
        }
        util.arraycopy(this.value, index + 1, this.value, index, this.count - index - 1);
        this.count--;
        return this;
    }

    deleteCharRange(start = 0, end = 0) {
        if (start < 0) {
            throw new RangeError('StringIndexOutOfBoundsException ' + start);
        }
        if (end > this.count || end === 0) {
            end = this.count;
        }
        if (start > end) {
            throw new RangeError('StringIndexOutOfBoundsException start > end');
        }
        let len = end - start;
        if (len > 0) {
            util.arraycopy(this.value, start + len, this.value, start, this.count - end);
            this.count -= len;
        }
        return this;
    }

    ensureCapacity(minimumCapacity = 0) {
        if (minimumCapacity > 0) {
            this.ensureCapacityInternal(minimumCapacity);
        }
    }

    ensureCapacityInternal(minimumCapacity = 0) {
        if (minimumCapacity - this.value.length > 0) {
            this.expandCapacity(minimumCapacity);
        }
    }

    expandCapacity(minimumCapacity = 0) {
        let newCapacity = this.value.length * 2 + 2;
        if (newCapacity - minimumCapacity < 0) {
            newCapacity = minimumCapacity;
        }
        if (newCapacity < 0) {
            if (minimumCapacity < 0) {
                throw new RangeError('OutOfMemoryError');
            }
            newCapacity = Number.MAX_VALUE;
        }
        this.value = util.copyOf(this.value, newCapacity);
    }

    getChars(srcBegin = 0, srcEnd = 0, dst = [], dstBegin = 0) {
        if (srcBegin < 0) {
            throw new RangeError('StringIndexOutOfBoundsException ' + srcBegin);
        }
        if ((srcEnd < 0) || (srcEnd > this.count)) {
            throw new RangeError('StringIndexOutOfBoundsException ' + srcEnd);
        }
        if (srcBegin > srcEnd) {
            throw new RangeError('StringIndexOutOfBoundsException srcBegin > srcEnd');
        }
        util.arraycopy(this.value, srcBegin, dst, dstBegin, srcEnd - srcBegin);
    }

    getValue() {
        return this.value;
    }

    indexOf(str, fromIndex = 0) {
        //TODO implements correctly => this
        return char.indexOf(this.value, 0, this.count, str, fromIndex);
    }

    insert(offset, v) {
        let len = 0;
        if ((offset < 0) || (offset > this.length())) {
            throw new RangeError('StringIndexOutOfBoundsException ' + offset);
        }
        if (typeof v === 'string') {
            let str = v;
            if (str === null) {
                str = "null";
            }
            len = str.length;
            this.ensureCapacityInternal(this.count + len);
            util.arraycopy(this.value, offset, this.value, offset + len, this.count - offset);
            char.getChars(this.value, offset);
        } else if (typeof v === 'number') {
            return this.insert(offset, String.fromCharCode(v));
        } else if (typeof v === 'boolean') {
            return this.insert(offset, v ? 'true' : 'false');
        } else if (v.constructor === Object) {
            try {
                return this.insert(offset, JSON.stringify(v));
            } catch (e) {
                return this.insert(offset, v.toString());
            }
        } else if (Array.isArray(v)) {
            let arr = v;
            len = arr.length;
            this.ensureCapacityInternal(this.count + len);
            util.arraycopy(this.value, offset, this.value, offset + len, this.count - offset);
            util.arraycopy(arr, 0, this.value, offset, len);
        }
        this.count += len;
        return this;
    }

    insertChars(index = 0, str = [], offset = 0, len = 0) {
        if (len === 0) {
            len = str.length;
        }
        if ((index < 0) || (index > this.length())) {
            throw new RangeError('StringIndexOutOfBoundsException ' + index);
        }
        if ((offset < 0) || (len < 0) || (offset > str.length - len)) {
            throw new RangeError('StringIndexOutOfBoundsException offset ' + offset + ', len ' + len + ', str.length ' + str.length);
        }
        this.ensureCapacityInternal(this.count + len);
        util.arraycopy(this.value, index, this.value, index + len, count - index);
        util.arraycopy(str, offset, this.value, index, len);
        this.count += len;
        return this;
    }

    lastIndexOf(str, fromIndex = 0) {
        //TODO implements correctly => this
        return char.lastIndexOf(this.value, 0, this.count, str, fromIndex);
    }

    length() {
        return this.count;
    }

    replace(start = 0, end = 0, str = '') {
        if (start < 0) {
            throw new RangeError('StringIndexOutOfBoundsException ' + start);
        }
        if (start > this.count) {
            throw new RangeError('StringIndexOutOfBoundsException start > length()');
        }
        if (start > end) {
            throw new RangeError('StringIndexOutOfBoundsException start > end');
        }
        if (end > this.count) {
            end = this.count;
        }
        let len = str.length;
        let newCount = this.count + len - (end - start);
        this.ensureCapacityInternal(newCount);
        util.arraycopy(this.value, end, this.value, start + len, this.count - end);
        char.getChars(str, this.value, start);
        this.count = newCount;
        return this;
    }

    reverse() {

    }

    setCharAt(index = 0, ch = 0) {
        if ((index < 0) || (index >= this.count)) {
            throw new RangeError('StringIndexOutOfBoundsException ' + index);
        }
        this.value[index] = ch;
    }

    setLength(newLength = 0) {
        if (newLength < 0) {
            throw new RangeError('StringIndexOutOfBoundsException ' + newLength);
        }
        this.ensureCapacityInternal(newLength);
        if (this.count < newLength) {
            //TODO implements => util.fill
            util.fill(this.value, this.count, newLength, char.NULL_TERMINATOR);
        }
        this.count = newLength;
    }

    substring(start = 0, end = 0) {
        if (end === 0) {
            end = this.count;
        }
        if (start < 0) {
            throw new RangeError('StringIndexOutOfBoundsException ' + start);
        }
        if (end > this.count) {
            throw new RangeError('StringIndexOutOfBoundsException ' + end);
        }
        if (start > end) {
            throw new RangeError('StringIndexOutOfBoundsException ' + (end - start));
        }
        return char.charBufferToString(this.value, start, end - start)
    }

    toString() {
        return char.charBufferToString(this.value);
    }

    trimToSize() {
        if (this.count < this.value.length) {
            this.value = util.copyOf(value, count);
        }
    }

}
