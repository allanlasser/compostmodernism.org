<nav class="admin-nav">
	<ul>
		<li><a href="/admin/posts">Posts</a></li>
		<li><a href="/admin/images">Images</a></li>
	</ul>
</nav>

<style>
	.admin-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-stack);
		padding-bottom: var(--space-stack);
		border-bottom: 1px solid var(--color-border);
	}

	.admin-nav ul {
		display: flex;
		gap: var(--space-gap);
	}

	.admin-nav a {
		text-decoration: none;
		font-style: italic;
	}

	.admin-nav a:hover {
		text-decoration: underline;
	}
</style>
