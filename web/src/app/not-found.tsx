import { Link } from "react-router";

export default function NotFoundPage() {
	return (
		<section className="mx-auto max-w-md text-center">
			<p className="text-6xl font-extrabold text-slate-200">404</p>
			<h1 className="mt-2 text-2xl font-bold text-slate-800">Page not found</h1>
			<p className="mt-2 text-sm text-slate-500">
				The page you requested does not exist.
			</p>
			<Link
				to="/"
				className="mt-6 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
			>
				Go home
			</Link>
		</section>
	);
}
