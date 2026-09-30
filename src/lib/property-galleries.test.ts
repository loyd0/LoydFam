import test from "node:test";
import assert from "node:assert/strict";
import { propertyGalleries } from "./property-galleries";
import type { PropertyRecord } from "./properties";

test("renamed and repeated headings never hide or duplicate property images", () => {
  const images = [
    {url:"portrait",kind:"portrait",sectionHeading:"Family"},
    {url:"house",kind:"historic",sectionHeading:"Building"},
    {url:"old-heading",sectionHeading:"Removed heading"},
    {url:"family",kind:"portrait",sectionHeading:"Family"},
    {url:"unassigned"},
  ] as PropertyRecord["images"];
  const paragraphs = [{heading:"Family"},{heading:"Family"},{heading:"Building"}] as PropertyRecord["paragraphs"];
  const galleries = propertyGalleries({images, paragraphs});
  assert.equal(galleries.featured?.url, "house");
  assert.deepEqual(galleries.sections.map(section => section.map(image => image.url)), [["portrait","family"],[],[]]);
  assert.deepEqual(galleries.remaining.map(image => image.url), ["old-heading","unassigned"]);
  assert.equal(new Set([galleries.featured!, ...galleries.sections.flat(), ...galleries.remaining]).size, images.length);
});

test("empty and portrait-only collections remain usable", () => {
  assert.equal(propertyGalleries({images:[], paragraphs:[]}).featured, undefined);
  const portrait = {url:"portrait",kind:"portrait"} as PropertyRecord["images"][number];
  assert.equal(propertyGalleries({images:[portrait],paragraphs:[]}).featured, portrait);
});
