import StreamCard from '@/components/StreamCard';
import FilterBar from '@/components/FilterBar';
import { mockStreams } from '@/data/mockData';

const Home = () => {
  return (
    <div>
      <FilterBar />
      
      <main className="p-4 lg:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
          {mockStreams.map((stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;
