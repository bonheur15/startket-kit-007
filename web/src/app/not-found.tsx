import { Link } from "react-router";

export default function NotFoundPage() {
	return (
		<section>
			<h1>404</h1>
			<p>The page you requested does not exist.</p>
			<Link to="/">Go home</Link>
		</section>
	);
}
