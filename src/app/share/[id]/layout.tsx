import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  return {
    title: "Коледно послание от Дядо Коледа",
    description: "Слушай коледното послание от Дядо Коледа!",
    openGraph: {
      title: "Коледно послание от Дядо Коледа",
      description: "Слушай коледното послание от Дядо Коледа!",
      url: `https://hoho.bg/share/${params.id}`,
      siteName: "HoHo.bg",
      images: [
        {
          url: "https://hoho.bg/santa.png",
          width: 512,
          height: 512,
          alt: "Дядо Коледа",
        },
      ],
      locale: "bg_BG",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Коледно послание от Дядо Коледа",
      description: "Слушай коледното послание от Дядо Коледа!",
      images: ["https://hoho.bg/santa.png"],
    },
  };
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
