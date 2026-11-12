export interface Tag {
  name: string;
  slug: string;
}

export interface Place {
  name: string;
  slug: string;
}

export interface Post {
  slug: string;
  body: string;
  title: string | null;
  url: string | null;
  date: number;
  tags: Tag[];
  place?: Place | null;
  permalink: string;
}

export interface Image {
  id: number;
  key: string;
  url: string;
  uploaded_at: number;
  title: string | null;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  usage_count: number;
}
export interface AdminPlace extends Place {
  id: number;
  latitude: number;
  longitude: number;
  count: number;
}
