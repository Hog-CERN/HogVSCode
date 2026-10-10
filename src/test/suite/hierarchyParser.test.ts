import * as assert from 'assert';
import { countNodes, parseHierarchy } from '../../hierarchyParser';

// Mirrors the format printed by print_hierarchy in Hog/Tcl/utils/hierarchy.tcl
const OUTPUT = [
	'INFO: [Hog:Msg-0] Top module from properties: work.vhdl_entity.top',
	'',
	'work.top (vhdl_entity) - /repo/sources/top/top.vhd',
	'  ├─ work.fifo_wrap (vhdl_entity) - /repo/sources/fifo_wrap.vhd',
	'  │ └─ xil_defaultlib.fifo_generator_0 (ip) - /repo/IP/fifo/fifo.xci',
	'  ├─ work.adder.rtl (vhdl_architecture) - /repo/sources/adder.vhd',
	'  └─ work.missing (vhdl_entity)',
	'',
	'',
	'=====Packages in project:=====',
	'Library: work',
	'  Package: my_pkg  - /repo/sources/my_pkg.vhd',
].join('\n');

suite('Hierarchy parser', () => {
	const result = parseHierarchy(OUTPUT);

	test('builds the tree from connectors', () => {
		assert.strictEqual(result.roots.length, 1);
		const top = result.roots[0];
		assert.strictEqual(top.library, 'work');
		assert.strictEqual(top.name, 'top');
		assert.deepStrictEqual(top.children.map(c => c.name), ['fifo_wrap', 'adder.rtl', 'missing']);
		assert.strictEqual(top.children[0].children[0].name, 'fifo_generator_0');
		assert.strictEqual(top.children[0].children[0].type, 'ip');
		assert.strictEqual(countNodes(result.roots), 5);
	});

	test('keeps paths and marks unresolved modules', () => {
		const top = result.roots[0];
		assert.strictEqual(top.path, '/repo/sources/top/top.vhd');
		assert.strictEqual(top.children[2].path, undefined);
	});

	test('parses warnings', () => {
		const r = parseHierarchy('work.a (vhdl_entity) - /x/a.vhd\n  └─ work.a (vhdl_entity) - /x/a.vhd [WARNING: circular reference detected]');
		assert.strictEqual(r.roots[0].children[0].warning, 'circular reference detected');
		assert.strictEqual(r.roots[0].children[0].path, '/x/a.vhd');
	});

	test('parses packages and ignores log lines and ANSI colours', () => {
		assert.deepStrictEqual(result.packages, [{ library: 'work', packages: [{ name: 'my_pkg', path: '/repo/sources/my_pkg.vhd' }] }]);
		const r = parseHierarchy('\u001b[32mINFO: hello\u001b[0m\nwork.top (vhdl_entity)');
		assert.strictEqual(r.roots.length, 1);
	});

	test('empty output gives an empty result', () => {
		assert.deepStrictEqual(parseHierarchy('ERROR: nothing'), { roots: [], packages: [] });
	});
});
