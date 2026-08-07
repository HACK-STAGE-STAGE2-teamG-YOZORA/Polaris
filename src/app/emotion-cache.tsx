"use client";

import * as React from "react";
import createCache from "@emotion/cache";
import type { EmotionCache, Options as EmotionCacheOptions } from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";

// MUI公式のNext.js App Router向けセットアップ(useServerInsertedHTML)をそのまま移植したもの。
// https://mui.com/material-ui/integrations/nextjs/
//
// App Routerはサーバーとクライアントでコンポーネントを1回ずつレンダリングするが、
// デフォルトのEmotionキャッシュはサーバー側で挿入したスタイル(data-emotion属性)の記録を
// クライアント側と共有できない。そのため、サーバーで挿入したスタイル名をここで記録しておき、
// useServerInsertedHTMLでhead内の<style>タグとして明示的に注入することで、
// サーバー/クライアント間のdata-emotion不一致によるHydration mismatchを防ぐ
export interface NextAppDirEmotionCacheProviderProps {
  options: Omit<EmotionCacheOptions, "insertionPoint">;
  CacheProvider?: React.ComponentType<{ value: EmotionCache; children: React.ReactNode }>;
  children: React.ReactNode;
}

export default function NextAppDirEmotionCacheProvider(
  props: NextAppDirEmotionCacheProviderProps,
) {
  const { options, CacheProvider: CustomCacheProvider = CacheProvider, children } = props;

  const [registry] = React.useState(() => {
    const cache = createCache(options);
    cache.compat = true;
    const prevInsert = cache.insert;
    let inserted: { name: string; isGlobal: boolean }[] = [];
    cache.insert = (...args) => {
      const [selector, serialized] = args;
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push({
          name: serialized.name,
          isGlobal: !selector,
        });
      }
      return prevInsert(...args);
    };
    const flush = () => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const inserted = registry.flush();
    if (inserted.length === 0) {
      return null;
    }
    let styles = "";
    let dataEmotionAttribute = registry.cache.key;

    const globals: { name: string; style: string }[] = [];

    inserted.forEach(({ name, isGlobal }) => {
      const style = registry.cache.inserted[name];

      if (typeof style !== "boolean" && style !== undefined) {
        if (isGlobal) {
          globals.push({ name, style });
        } else {
          dataEmotionAttribute += ` ${name}`;
          styles += style;
        }
      }
    });

    return (
      <>
        {globals.map(({ name, style }) => (
          <style
            key={name}
            data-emotion={`${registry.cache.key}-global ${name}`}
            dangerouslySetInnerHTML={{ __html: style }}
          />
        ))}
        {styles && (
          <style data-emotion={dataEmotionAttribute} dangerouslySetInnerHTML={{ __html: styles }} />
        )}
      </>
    );
  });

  return <CustomCacheProvider value={registry.cache}>{children}</CustomCacheProvider>;
}
