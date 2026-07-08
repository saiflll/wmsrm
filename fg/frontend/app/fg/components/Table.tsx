"use client";
import {
  Table as MTable,
  Box,
  type TableProps,
  type TableTheadProps,
  type TableTbodyProps,
  type TableTrProps,
  type TableThProps,
  type TableTdProps,
} from "@mantine/core";
import { useRef, useEffect, type ReactNode } from "react";

function attachResize(table: HTMLTableElement) {
  const cols = table.querySelectorAll<HTMLElement>("th");
  const handles: HTMLElement[] = [];

  cols.forEach((th) => {
    if (th.querySelector(".cr-handle")) return;

    const handle = document.createElement("div");
    handle.className = "cr-handle";
    Object.assign(handle.style, {
      position: "absolute",
      right: "0",
      top: "0",
      bottom: "0",
      width: "5px",
      cursor: "col-resize",
      zIndex: "2",
      userSelect: "none",
    });
    th.style.position = "relative";
    th.appendChild(handle);
    handles.push(handle);

    let startX = 0;
    let startW = 0;
    const onDown = (e: MouseEvent) => {
      startX = e.clientX;
      startW = th.offsetWidth;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      const w = Math.max(40, startW + (e.clientX - startX));
      th.style.width = `${w}px`;
      th.style.minWidth = `${w}px`;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    handle.addEventListener("mousedown", onDown);
  });

  return () => handles.forEach((h) => h.remove());
}

function Table({ children, ...props }: TableProps & { children?: ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachResize(el);
  });

  return (
    <Box style={{ overflowX: "auto" }}>
      <MTable ref={ref} {...props}>
        {children}
      </MTable>
    </Box>
  );
}

Table.Thead = MTable.Thead;
Table.Tbody = MTable.Tbody;
Table.Tr = MTable.Tr;
Table.Th = MTable.Th;
Table.Td = MTable.Td;

export { Table };
export type {
  TableProps,
  TableTheadProps,
  TableTbodyProps,
  TableTrProps,
  TableThProps,
  TableTdProps,
};
