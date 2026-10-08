import { useParams } from "react-router";

export default function UserPage() {
	const { id } = useParams();

	return (
		<section className="mx-auto max-w-2xl">
			<h1 className="text-3xl font-extrabold text-slate-800">User</h1>
			<p className="mt-2 text-slate-600">
				Dynamic segment from <code>src/app/users/[id]/page.tsx</code>:{" "}
				<b>{id}</b>
			</p>
		</section>
	);
}
