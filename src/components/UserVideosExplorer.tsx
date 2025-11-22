import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Video = {
  id: string;
  text: string;
  videoUrl?: string;
  audioUrl?: string;
  createdAt: number;
};

interface UserVideosExplorerProps {
  userId: string;
  onSelectVideo: (videoUrl: string) => void;
  onClose: () => void;
}

export default function UserVideosExplorer({ userId, onSelectVideo, onClose }: UserVideosExplorerProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        // Note: This query requires a composite index on [userId, createdAt]
        // If it fails, we might need to remove orderBy or create the index
        const q = query(
          collection(db, 'sharedMessages'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        
        const querySnapshot = await getDocs(q);
        const fetchedVideos: Video[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.videoUrl) {
            fetchedVideos.push({
              id: doc.id,
              text: data.text,
              videoUrl: data.videoUrl,
              audioUrl: data.audioUrl,
              createdAt: data.createdAt,
            });
          }
        });
        setVideos(fetchedVideos);
      } catch (error) {
        console.error("Error fetching user videos:", error);
        // Fallback without sorting if index is missing
        try {
             const q = query(
              collection(db, 'sharedMessages'),
              where('userId', '==', userId),
              limit(20)
            );
            const querySnapshot = await getDocs(q);
            const fetchedVideos: Video[] = [];
            querySnapshot.forEach((doc) => {
              const data = doc.data();
              if (data.videoUrl) {
                fetchedVideos.push({
                  id: doc.id,
                  text: data.text,
                  videoUrl: data.videoUrl,
                  audioUrl: data.audioUrl,
                  createdAt: data.createdAt,
                });
              }
            });
            // Sort client-side
            fetchedVideos.sort((a, b) => b.createdAt - a.createdAt);
            setVideos(fetchedVideos);
        } catch (retryError) {
            console.error("Retry failed:", retryError);
        }
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchVideos();
    }
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-pink-50/50">
          <h2 className="text-2xl font-black text-[#d91f63]">Моите видеа 🎬</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-pink-100 text-[#d91f63] transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="size-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ffd7ec] border-t-[#ff5a9d]"></div>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-bold mb-2">Все още нямате създадени видеа.</p>
              <p className="text-sm">Създайте своето първо коледно послание сега! 🎅</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videos.map((video) => (
                <div 
                  key={video.id} 
                  onClick={() => {
                    onSelectVideo(video.videoUrl!);
                    onClose();
                  }}
                  className="group relative aspect-video rounded-xl overflow-hidden border-2 border-gray-100 cursor-pointer hover:border-[#ff5a9d] transition shadow-sm hover:shadow-md"
                >
                  <video 
                    src={`${video.videoUrl}#t=0.1`} 
                    className="w-full h-full object-cover"
                    preload="metadata"
                    playsInline
                    muted
                    poster="/santa-talking.webp"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6 text-[#d91f63] ml-1">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-3">
                    <p className="text-white text-xs font-medium truncate">{video.text}</p>
                    <p className="text-white/70 text-[10px]">{new Date(video.createdAt).toLocaleDateString('bg-BG')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
