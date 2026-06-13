import { useParams } from "react-router";

export default function UserPage() {
	const { id } = useParams();

	return (
		<section>
			<h1>User</h1>
			<p>User ID: {id}</p>
		</section>
	);
}
