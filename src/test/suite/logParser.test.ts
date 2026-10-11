import * as assert from 'assert';
import { parseLog, parseLogLine, sourceOf } from '../../logParser';

suite('Log parser', () => {
	test('parses Hog messages', () => {
		assert.deepStrictEqual(parseLogLine('ERROR: [Hog:CreateProject] Project demo not found'), {
			severity: 'error', id: 'Hog:CreateProject', message: 'Project demo not found', file: undefined, line: undefined,
		});
		assert.strictEqual(parseLogLine('CRITICAL WARNING: [Hog:Msg-0] Repository is dirty')?.severity, 'critical');
	});

	test('parses Vivado messages with a location', () => {
		const msg = parseLogLine("ERROR: [Synth 8-439] module 'fifo' not found [/repo/sources/top.vhd:12]")!;
		assert.strictEqual(msg.id, 'Synth 8-439');
		assert.strictEqual(msg.message, "module 'fifo' not found");
		assert.strictEqual(msg.file, '/repo/sources/top.vhd');
		assert.strictEqual(msg.line, 12);
	});

	test('parses Windows paths with a drive letter', () => {
		const msg = parseLogLine('WARNING: [Synth 8-3331] design top has unconnected port x [C:/repo/top.vhd:3]')!;
		assert.strictEqual(msg.file, 'C:/repo/top.vhd');
		assert.strictEqual(msg.line, 3);
	});

	test('keeps brackets inside messages that are not locations', () => {
		const msg = parseLogLine('CRITICAL WARNING: [Vivado 12-1411] Cannot set LOC property of ports [get_ports clk]')!;
		assert.strictEqual(msg.file, undefined);
		assert.strictEqual(msg.message, 'Cannot set LOC property of ports [get_ports clk]');
	});

	test('ignores info, debug and plain lines', () => {
		for (const line of ['INFO: [Hog:Msg-0] Creating project', 'DEBUG: [Hog:x] y', 'ERROR without id', '', 'Process exited with code 1']) {
			assert.strictEqual(parseLogLine(line), undefined, line);
		}
	});

	test('removes duplicates', () => {
		const line = 'ERROR: [Hog:A] boom';
		assert.strictEqual(parseLog([line, 'INFO: x', line, 'ERROR: [Hog:A] other'].join('\n')).length, 2);
	});

	test('names the source tool', () => {
		assert.strictEqual(sourceOf('Hog:CreateProject'), 'Hog');
		assert.strictEqual(sourceOf('Synth 8-439'), 'Synth');
		assert.strictEqual(sourceOf('Vivado 12-1411'), 'Vivado');
	});
});
