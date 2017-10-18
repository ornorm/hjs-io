/** @babel */
import * as char from "hjs-core/lib/char";
import * as util from "hjs-core/lib/util";

const NEED_CHAR = Number.MAX_VALUE;
const SKIP_LF = Number.MAX_VALUE - 1;
const CT_WHITESPACE = 1;
const CT_DIGIT = 2;
const CT_ALPHA = 4;
const CT_QUOTE = 8;
const CT_COMMENT = 16;
const TT_EOF = -1;
const TT_EOL = char.NEWLINE;
const TT_NUMBER = -2;
const TT_WORD = -3;
const TT_NOTHING = -4;

export class StreamTokenizer {

    constructor({input, reader} = {}) {
        if (input === null && reader === null) {
            throw new ReferenceError("NullPointerException");
        }
        this.ttype = -4;
        this.peekc = Number.MAX_VALUE;
        this.pushedBack = false;
        this.forceLower = false;
        this.eolIsSignificantP = false;
        this.slashSlashCommentsP = false;
        this.slashStarCommentsP = false;
        this.LINENO = 1;
        this.buf = new Array(20);
        this.ctype = new Array(256);
        this.nval = 0.0;
        this.sval = null;
        this.input = input;
        this.reader = reader;
        this.wordChars(char.a, char.z);
        this.wordChars(char.A, char.Z);
        this.wordChars(128 + 32, 255);
        this.whitespaceChars(0, char.SPACE);
        this.commentChar(char.SLASH);
        this.quoteChar(char.DOUBLE_QUOTE);
        this.quoteChar(char.SINGLE_QUOTE);
        this.parseNumbers();
    }

    commentChar(ch = 0) {
        if (ch >= 0 && ch < this.ctype.length) {
            this.ctype[ch] = CT_COMMENT;
        }
    }

    lineno() {
        return this.LINENO;
    }

    lowerCaseMode(fl = false) {
        this.forceLower = fl;
    }

    eolIsSignificant(flag) {
        this.eolIsSignificantP = flag;
    }

    nextToken() {
        if (this.pushedBack) {
            this.pushedBack = false;
            return this.ttype;
        }
        let ct = this.ctype;
        this.sval = null;
        let c = this.peekc;
        if (c < 0) {
            c = NEED_CHAR;
        }
        if (c === SKIP_LF) {
            c = this.read();
            if (c < 0) {
                return this.ttype = TT_EOF;
            }
            if (c === char.NEWLINE) {
                c = NEED_CHAR;
            }
        }
        if (c === NEED_CHAR) {
            c = this.read();
            if (c < 0) {
                return this.ttype = TT_EOF;
            }
        }
        /* Just to be safe */
        this.ttype = c;
        /* Set peekc so that the next invocation of nextToken will read
         * another character unless peekc is reset in this invocation
         */
        this.peekc = NEED_CHAR;
        let ctype = c < 256 ? ct[c] : CT_ALPHA;
        while ((ctype & CT_WHITESPACE) !== 0) {
            if (c === char.CARRIAGE_RETURN) {
                this.LINENO++;
                if (this.eolIsSignificantP) {
                    this.peekc = SKIP_LF;
                    return this.ttype = TT_EOL;
                }
                c = this.read();
                if (c === char.NEWLINE) {
                    c = this.read();
                }
            } else {
                if (c === char.NEWLINE) {
                    this.LINENO++;
                    if (this.eolIsSignificantP) {
                        return this.ttype = TT_EOL;
                    }
                }
                c = this.read();
            }
            if (c < 0) {
                return this.ttype = TT_EOF;
            }
            ctype = c < 256 ? ct[c] : CT_ALPHA;
        }
        if ((ctype & CT_DIGIT) !== 0) {
            let neg = false;
            if (c === char.DASH) {
                c = this.read();
                if (c !== char.DOT && (c < char.ZERO || c > char.NINE)) {
                    this.peekc = c;
                    return this.ttype = char.DOT;
                }
                neg = true;
            }
            let v = 0;
            let decexp = 0;
            let seendot = 0;
            while (true) {
                if (c === char.DOT && seendot === 0) {
                    seendot = 1;
                } else if (char.ZERO <= c && c <= char.NINE) {
                    v = v * 10 + (c - char.ZERO);
                    decexp += seendot;
                } else {
                    break;
                }
                c = this.read();
            }
            this.peekc = c;
            if (decexp !== 0) {
                let denom = 10;
                decexp--;
                while (decexp > 0) {
                    denom *= 10;
                    decexp--;
                }
                /* Do one division of a likely-to-be-more-accurate number */
                v = v / denom;
            }
            this.nval = neg ? -v : v;
            return this.ttype = TT_NUMBER;
        }
        if ((ctype & CT_ALPHA) !== 0) {
            let i = 0;
            do {
                if (i >= this.buf.length) {
                    this.buf = util.copyOf(this.buf, this.buf.length * 2);
                }
                this.buf[i++] = c;
                c = this.read();
                ctype = c < 0 ? CT_WHITESPACE : c < 256 ? ct[c] : CT_ALPHA;
            } while ((ctype & (CT_ALPHA | CT_DIGIT)) !== 0);
            this.peekc = c;
            //TODO: implements >> util.copyValueOf
            this.sval = util.copyValueOf(this.buf, 0, i);
            if (this.forceLower) {
                this.sval = this.sval.toLowerCase();
            }
            return this.ttype = TT_WORD;
        }
        if ((ctype & CT_QUOTE) !== 0) {
            this.ttype = c;
            let i = 0;
            /* Invariants (because \Octal needs a lookahead):
             *   (i)  c contains char value
             *   (ii) d contains the lookahead
             */
            let d = this.read();
            while (d >= 0 && d !== this.ttype && d !== char.NEWLINE && d !== char.CARRIAGE_RETURN) {
                if (d === char.BACK_SLASH) {
                    c = this.read();
                    //let first = c;
                    /* To allow \377, but not \477 */
                    if (c >= char.ZERO && c <= char.SEVEN) {
                        c = c - char.ZERO;
                        let c2 = this.read();
                        if (char.ZERO <= c2 && c2 <= char.SEVEN) {
                            c = (c << 3) + (c2 - char.ZERO);
                            c2 = this.read();
                            if (char.ZERO <= c2 && c2 <= char.SEVEN && c <= char.THREE) {
                                c = (c << 3) + (c2 - char.ZERO);
                                d = this.read();
                            } else {
                                d = c2;
                            }
                        } else {
                            d = c2;
                        }
                    } else {
                        switch (c) {
                            case char.a:
                                c = 0x7;
                                break;
                            case char.b:
                                c = '\b';
                                break;
                            case char.f:
                                c = 0xC;
                                break;
                            case char.n:
                                c = char.NEWLINE;
                                break;
                            case char.r:
                                c = char.CARRIAGE_RETURN;
                                break;
                            case char.t:
                                c = char.TAB;
                                break;
                            case char.v:
                                c = 0xB;
                                break;
                        }
                        d = this.read();
                    }
                } else {
                    c = d;
                    d = this.read();
                }
                if (i >= this.buf.length) {
                    this.buf = util.copyOf(this.buf, this.buf.length * 2);
                }
                this.buf[i++] = c;
            }
            /* If we broke out of the loop because we found a matching quote
             * character then arrange to read a new character next time
             * around; otherwise, save the character.
             */
            this.peekc = (d === this.ttype) ? NEED_CHAR : d;
            //TODO implements >> util.copyValueOf
            this.sval = util.copyValueOf(this.buf, 0, i);
            if (this.forceLower) {
                this.sval = this.sval.toLowerCase();
            }
            return this.ttype;
        }
        if (c === char.SLASH && (this.slashSlashCommentsP || this.slashStarCommentsP)) {
            c = this.read();
            if (c === char.ASTERISK && this.slashStarCommentsP) {
                let prevc = 0;
                while ((c = this.read()) !== char.SLASH || prevc !== char.ASTERISK) {
                    if (c === char.CARRIAGE_RETURN) {
                        this.LINENO++;
                        c = this.read();
                        if (c === char.NEWLINE) {
                            c = this.read();
                        }
                    } else {
                        if (c === char.NEWLINE) {
                            this.LINENO++;
                            c = this.read();
                        }
                    }
                    if (c < 0) {
                        return this.ttype = TT_EOF;
                    }
                    prevc = c;
                }
                return this.nextToken();
            } else if (c === char.SLASH && this.slashSlashCommentsP) {
                do {
                    c = this.read();
                } while (c !== char.NEWLINE && c !== char.CARRIAGE_RETURN && c >= 0);
                this.peekc = c;
                return this.nextToken();
            } else {
                /* Now see if it is still a single line comment */
                if ((ct[char.SLASH] & CT_COMMENT) !== 0) {
                    do {
                        c = this.read();
                    } while (c !== char.NEWLINE && c !== char.CARRIAGE_RETURN && c >= 0);
                    this.peekc = c;
                    return this.nextToken();
                } else {
                    this.peekc = c;
                    return this.ttype = char.SLASH;
                }
            }
        }
        if ((ctype & CT_COMMENT) !== 0) {
            do {
                c = this.read();
            } while (c !== char.NEWLINE && c !== char.CARRIAGE_RETURN && c >= 0);
            this.peekc = c;
            return this.nextToken();
        }
        return this.ttype = c;
    }

    ordinaryChar(ch = 0) {
        if (ch >= 0 && ch < this.ctype.length) {
            this.ctype[ch] = 0;
        }
    }

    ordinaryChars(low = 0, hi = 0) {
        if (low < 0) {
            low = 0;
        }
        if (hi >= this.ctype.length) {
            hi = this.ctype.length - 1;
        }
        while (low <= hi) {
            this.ctype[low++] = 0;
        }
    }

    parseNumbers() {
        if (this.ttype !== TT_NOTHING) {
            /* No-op if nextToken() not called */
            this.pushedBack = true;
        }
    }

    quoteChar(ch = 0) {
        if (ch >= 0 && ch < this.ctype.length) {
            this.ctype[ch] = CT_QUOTE;
        }
    }

    read() {
        if (this.reader !== null) {
            return this.reader.read();
        } else if (this.input !== null) {
            return this.input.read();
        } else {
            throw new EvalError("IllegalStateException");
        }
    }

    resetSyntax() {
        for (let i = this.ctype.length; --i >= 0;) {
            this.ctype[i] = 0;
        }
    }

    slashSlashComments(flag = true) {
        this.slashSlashCommentsP = flag;
    }

    slashStarComments(flag = true) {
        this.slashStarCommentsP = flag;
    }

    toString() {
        let ret;
        switch (this.ttype) {
            case TT_EOF:
                ret = "EOF";
                break;
            case TT_EOL:
                ret = "EOL";
                break;
            case TT_WORD:
                ret = this.sval;
                break;
            case TT_NUMBER:
                ret = "n=" + this.nval;
                break;
            case TT_NOTHING:
                ret = "NOTHING";
                break;
            default: {
                /*
                 * ttype is the first character of either a quoted string or
                 * is an ordinary character. ttype can definitely not be less
                 * than 0, since those are reserved values used in the previous
                 * case statements
                 */
                if (this.ttype < 256 &&
                    ((this.ctype[this.ttype] & CT_QUOTE) !== 0)) {
                    ret = this.sval;
                    break;
                }
                let s = new Array(3);
                s[0] = s[2] = char.SINGLE_QUOTE;
                s[1] = this.ttype;
                ret = char.charBufferToString(s);
                break;
            }
        }
        return "Token[" + ret + "], line " + this.LINENO;
    }

    whitespaceChars(low = 0, hi = 0) {
        if (low < 0) {
            low = 0;
        }
        if (hi >= this.ctype.length) {
            hi = this.ctype.length - 1;
        }
        while (low <= hi) {
            this.ctype[low++] = CT_WHITESPACE;
        }
    }

    wordChars(low = 0, hi = 0) {
        if (low < 0) {
            low = 0;
        }
        if (hi >= this.ctype.length) {
            hi = this.ctype.length - 1;
        }
        while (low <= hi) {
            this.ctype[low++] |= CT_ALPHA;
        }
    }
}
