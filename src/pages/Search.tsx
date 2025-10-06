import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import StreamCard from "@/components/StreamCard";
import { ShortCard } from "@/components/ShortCard";
import { CreatorCard } from "@/components/CreatorCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Search() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>({ livestreams: [], short_videos: [], profiles: [] });

  useEffect(() => {
    document.title = query ? `Search: ${query} - Wutch` : "Search - Wutch";
  }, [query]);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ livestreams: [], short_videos: [], profiles: [] });
      return;
    }

    setLoading(true);
    try {
      // Strip @ symbol from search query if present
      const cleanQuery = searchQuery.replace(/^@+/, '');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search?q=${encodeURIComponent(cleanQuery)}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        }
      });

      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setResults(data || { livestreams: [], short_videos: [], profiles: [] });
    } catch (error) {
      console.error("Search error:", error);
      setResults({ livestreams: [], short_videos: [], profiles: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setQuery(searchInput);
    navigate(`/search?q=${encodeURIComponent(searchInput)}`);
  };

  const totalResults = 
    (results.livestreams?.length || 0) + 
    (results.short_videos?.length || 0) + 
    (results.profiles?.length || 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Search</h1>
          <div className="flex gap-2 max-w-2xl">
            <Input
              type="text"
              placeholder="Search streams, shorts, creators..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} size="icon">
              <SearchIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Results */}
        {!loading && query && (
          <>
            <p className="text-muted-foreground mb-6">
              {totalResults} result{totalResults !== 1 ? "s" : ""} for "{query}"
            </p>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="all">All ({totalResults})</TabsTrigger>
                <TabsTrigger value="streams">
                  Streams ({results.livestreams?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="shorts">
                  Shorts ({results.short_videos?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="creators">
                  Creators ({results.profiles?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* All Results */}
              <TabsContent value="all">
                {totalResults === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-muted-foreground">No results found</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {results.profiles?.length > 0 && (
                      <div>
                        <h2 className="text-xl font-semibold mb-4">Creators</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {results.profiles.map((profile: any) => (
                            <CreatorCard key={profile.id} profile={profile} />
                          ))}
                        </div>
                      </div>
                    )}

                    {results.livestreams?.length > 0 && (
                      <div>
                        <h2 className="text-xl font-semibold mb-4">Livestreams</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {results.livestreams.map((stream: any) => (
                            <StreamCard key={stream.id} stream={stream} />
                          ))}
                        </div>
                      </div>
                    )}

                    {results.short_videos?.length > 0 && (
                      <div>
                        <h2 className="text-xl font-semibold mb-4">Shorts</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {results.short_videos.map((short: any) => (
                            <ShortCard key={short.id} short={short} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Streams Tab */}
              <TabsContent value="streams">
                {results.livestreams?.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-muted-foreground">No streams found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.livestreams?.map((stream: any) => (
                      <StreamCard key={stream.id} stream={stream} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Shorts Tab */}
              <TabsContent value="shorts">
                {results.short_videos?.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-muted-foreground">No shorts found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {results.short_videos?.map((short: any) => (
                      <ShortCard key={short.id} short={short} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Creators Tab */}
              <TabsContent value="creators">
                {results.profiles?.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-muted-foreground">No creators found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.profiles?.map((profile: any) => (
                      <CreatorCard key={profile.id} profile={profile} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Empty State */}
        {!loading && !query && (
          <div className="text-center py-20">
            <SearchIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Start typing to search</p>
          </div>
        )}
      </div>
    </div>
  );
}
