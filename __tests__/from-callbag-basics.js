const {
	forEach,
	interval,
	fromIter,
	take,
	map,
	filter,
	pipe,
	scan,
} = require("../index")

test("it works with observables", async => {
	const expected = [1, 3, 5, 7, 9]

	pipe(
		interval(10),
		map(x => x + 1),
		filter(x => x % 2),
		take(5),
		scan((a, v) => a.concat(v), []),
		filter(x => x.length === expected.length),
		forEach(x => {
			expect(x).toEqual(expected)
			async()
		})
	)
})

test("it works with iterables", async => {
	const expected = [10, 10.25, 10.5, 10.75, 11]

	function* range(from, to) {
		let i = from
		while (i <= to) {
			yield i
			i++
		}
	}

	pipe(
		fromIter(range(40, 99)),
		take(5),
		map(x => x / 4),
		scan((a, v) => a.concat(v), []),
		filter(x => x.length === expected.length),
		forEach(x => {
			expect(x).toEqual(expected)
			async()
		})
	)
})
