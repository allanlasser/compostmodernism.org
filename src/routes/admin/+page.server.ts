import { redirect, type ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
	throw redirect(303, '/admin/posts');
};
