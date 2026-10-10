"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const listParser_1 = require("../../listParser");
suite('List file parser', () => {
    test('ignores comments, blanks, sections and properties', () => {
        for (const line of ['', '   ', '# Simulator xsim', '[files]', '[properties]', 'TOP=TB_fifo', 'PART = xc7a35t', 'options="-frelaxed"']) {
            assert.strictEqual((0, listParser_1.parseListLine)(line, '.sim'), undefined, line);
        }
    });
    test('parses a path with modifiers', () => {
        const parsed = (0, listParser_1.parseListLine)('sources/top/top_fifo.vhd top=top_fifo 93  nosynth # trailing', '.src');
        assert.deepStrictEqual(parsed.paths.map(p => p.text), ['sources/top/top_fifo.vhd']);
        assert.deepStrictEqual(parsed.modifiers.map(m => m.text), ['top=top_fifo', '93', 'nosynth']);
        assert.strictEqual(parsed.modifiers[0].start, 25);
    });
    test('parses two paths in .ipb files', () => {
        const parsed = (0, listParser_1.parseListLine)('sources/xml/common.xml sources/ipbus/decode.vhd', '.ipb');
        assert.strictEqual(parsed.paths.length, 2);
        assert.strictEqual(parsed.modifiers.length, 0);
    });
    test('parses the md5 hash of .ext files', () => {
        const parsed = (0, listParser_1.parseListLine)('/afs/x/file_1.vhd 725cda057150d688c7970cfc53dc6db6', '.ext');
        assert.strictEqual(parsed.hash?.text, '725cda057150d688c7970cfc53dc6db6');
        assert.strictEqual(parsed.modifiers.length, 0);
    });
    test('detects dynamic paths', () => {
        assert.ok((0, listParser_1.isDynamicPath)('dlx/*.vhdl'));
        assert.ok((0, listParser_1.isDynamicPath)('$env/file.vhd'));
        assert.ok(!(0, listParser_1.isDynamicPath)('sources/src/adder.vhd'));
    });
    test('finds the repository root', () => {
        assert.strictEqual((0, listParser_1.repoRootFromListPath)('/home/me/repo/Top/fifo/list/fifo.src'), '/home/me/repo');
        assert.strictEqual((0, listParser_1.repoRootFromListPath)('/home/me/other/file.src'), undefined);
    });
});
//# sourceMappingURL=listParser.test.js.map