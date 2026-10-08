export default function AboutPage() {
	return (
		<section className="prose mx-auto max-w-2xl">
			<h1 className="text-3xl font-extrabold text-slate-800">About</h1>
			<p className="mt-4 text-slate-600">
				This page comes from <code>src/app/about/page.tsx</code>. Add a folder
				with a <code>page.tsx</code> to create a route, a{" "}
				<code>layout.tsx</code> to wrap its children, and wrap a folder name in
				parentheses to group routes without changing the URL.
			</p>
		</section>
	);
}
