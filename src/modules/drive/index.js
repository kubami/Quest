import _ from "lodash";
import React from "react";
import { hasCorrectTokens, makeGoogleRequest, hashConfiguration } from "../../shared/google-auth";
import { Link } from "react-router-dom";
import { Time } from "../../components/time";
import { ExternalLink } from "../../components/external-link";
import { Classes, Button, Spinner, Tab, Tabs, Tooltip, Callout } from "@blueprintjs/core";
import logo from "./logo.png";
import qs from "qs";
import { Document, Page } from "react-pdf/dist/entry.webpack";

import styles from "./drive.module.css";
import ReactMarkdown from "react-markdown";
import {
  DATE_FILTERS,
  DATE_FILTERS_DESCRIPTION,
  DateFilter,
  Filter,
  OwnerFilter,
  OWNERSHIP_FILTERS,
} from "../../components/filters/filters";
import { PaginatedResults } from "../../components/paginated-results/paginated-results";
import { useQuery } from "react-query";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

const TYPE_FILTERS = {
  ANY: "any",
  DOCUMENT: "document",
  SPREADSHEET: "spreadsheet",
  PRESENTATION: "presentation",
  IMAGE: "image",
};

const TYPE_FILTER_DESCRIPTION = {
  [TYPE_FILTERS.ANY]: {
    value: "Any",
    mimeTypes: [],
  },
  [TYPE_FILTERS.DOCUMENT]: {
    value: "Documents",
    mimeTypes: [
      "application/vnd.google-apps.document",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
      "text/html",
      "application/pdf",
      "application/epub+zip",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
  },
  [TYPE_FILTERS.SPREADSHEET]: {
    value: "Spreadsheets",
    mimeTypes: [
      "application/vnd.google-apps.spreadsheet",
      "application/x-vnd.oasis.opendocument.spreadsheet",
      "text/tab-separated-values",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/vnd.oasis.opendocument.spreadsheet",
    ],
  },
  [TYPE_FILTERS.PRESENTATION]: {
    value: "Presentations",
    mimeTypes: [
      "application/vnd.google-apps.presentation",
      "application/vnd.oasis.opendocument.presentation",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
  [TYPE_FILTERS.IMAGE]: {
    value: "Images",
    mimeTypes: ["application/vnd.google-apps.drawing", "image/svg+xml", "image/png", "image/jpeg"],
  },
};

const MIME_TYPES = {
  TEXT: "text/plain",
  PDF: "application/pdf",
};

const formatFetcher = async (itemId, accessToken, mimeType) => {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${itemId}/export?${qs.stringify({ mimeType })}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return mimeType === MIME_TYPES.TEXT ? res.text() : res.blob();
};

function PDFView({ configuration, item }) {
  const [numPages, setNumPages] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const { data } = useQuery(
    [item.id, configuration.nested.accessToken.get(), MIME_TYPES.PDF],
    formatFetcher
  );
  const { thumbnailLink, hasThumbnail } = item;

  React.useEffect(() => {
    setNumPages(0);
    setCurrentPage(1);
  }, [item]);

  if (!data) {
    return (
      <div className={styles.preview}>
        {hasThumbnail && <img src={thumbnailLink} alt="Preview" />}
        <Spinner />
      </div>
    );
  }
  return (
    <div className={styles.pdfView}>
      <div className={styles.navigation}>
        <Button
          disabled={currentPage <= 1}
          icon={"chevron-left"}
          minimal={true}
          onClick={() => setCurrentPage(currentPage - 1)}
        />
        <p>
          Page {currentPage} of {numPages}
        </p>
        <Button
          disabled={currentPage >= numPages}
          icon={"chevron-right"}
          minimal={true}
          onClick={() => setCurrentPage(currentPage + 1)}
        />
      </div>
      <Document
        className={styles.document}
        file={data}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={
          <div className={styles.preview}>
            {hasThumbnail && <img src={thumbnailLink} alt="Preview" />}
            <Spinner />
          </div>
        }
      >
        <Page
          className={styles.page}
          pageNumber={currentPage}
          loading={
            <div className={styles.preview}>
              {hasThumbnail && <img src={thumbnailLink} alt="Preview" />}
              <Spinner />
            </div>
          }
        />
      </Document>
    </div>
  );
}

function TextView({ item, configuration }) {
  const { data, error } = useQuery(
    [item.id, configuration.nested.accessToken.get(), MIME_TYPES.TEXT],
    formatFetcher
  );

  if (!data) {
    return <Spinner />;
  }

  return (
    <div style={{ whiteSpace: "pre-wrap", paddingTop: "10px" }}>
      {error ? (
        <Callout>Preview cannot be loaded.</Callout>
      ) : (
        <p className={Classes.RUNNING_TEXT}>{data && <ReactMarkdown source={data} />}</p>
      )}
    </div>
  );
}

function DriveItemRender({ item }) {
  const { name, webViewLink, iconLink, modifiedTime } = item;
  return (
    <>
      <p>
        <Tooltip content={name} openOnTargetFocus={false}>
          <img src={iconLink} alt="file icon" />
        </Tooltip>
        {"  "}
        <ExternalLink href={webViewLink}>{name}</ExternalLink>
      </p>
      <p>
        Last updated <Time iso={modifiedTime} />
      </p>
    </>
  );
}

function DriveDetailComponent({ item, configuration }) {
  const [currentTab, setCurrentTab] = React.useState(MIME_TYPES.TEXT);

  const {
    name,
    iconLink,
    webViewLink,
    modifiedTime,
    exportLinks,
    hasThumbnail,
    thumbnailLink,
  } = item;

  const supportedFormats = new Set(_.isObject(exportLinks) ? Object.keys(exportLinks) : []);

  React.useEffect(() => {
    if (!supportedFormats.has(currentTab)) {
      const mimeType = Object.values(MIME_TYPES).find((mimeTypes) =>
        supportedFormats.has(mimeTypes)
      );
      setCurrentTab(mimeType);
    }
  }, [item]);

  return (
    <div>
      <p>
        <Tooltip content={name} openOnTargetFocus={false}>
          <img src={iconLink} alt="file icon" />
        </Tooltip>
        {"  "}
        <ExternalLink href={webViewLink}>{name}</ExternalLink>
      </p>
      <p>
        Last updated <Time iso={modifiedTime} />
      </p>
      {currentTab ? (
        <Tabs id="FormatTabs" onChange={setCurrentTab} selectedTabId={currentTab}>
          {supportedFormats.has(MIME_TYPES.TEXT) && (
            <Tab
              id={MIME_TYPES.TEXT}
              title="Text"
              panel={<TextView item={item} configuration={configuration} />}
            />
          )}
          {supportedFormats.has(MIME_TYPES.PDF) && (
            <Tab
              id={MIME_TYPES.PDF}
              title="PDF"
              panel={<PDFView item={item} configuration={configuration} />}
            />
          )}
        </Tabs>
      ) : (
        <div>
          {hasThumbnail ? (
            <img src={thumbnailLink} alt="Preview" />
          ) : (
            <Callout>Unable to render this document</Callout>
          )}
        </div>
      )}
    </div>
  );
}

function generateTypeQuery(fileType) {
  const types = TYPE_FILTER_DESCRIPTION[fileType].mimeTypes;
  return `(${types.map((type) => `mimeType = '${type}'`).join(" or ")})`;
}

const makeGoogleDriveFetcher = (configuration) => async (
  key,
  { input, queryObj, fileType, owner, dateFilter },
  cursor
) => {
  // https://developers.google.com/drive/api/v3/ref-search-terms
  const text = input.replace(/'/, "\\'");
  const query = [`(name contains '${text}' or fullText contains '${text}')`];

  queryObj.exclude.text.forEach((word) =>
    query.push(`(not (name contains '${word}' or fullText contains '${word}'))`)
  );

  if (fileType !== TYPE_FILTERS.ANY) {
    query.push(`${generateTypeQuery(fileType)}`);
  }

  if (owner === OWNERSHIP_FILTERS.ME) {
    query.push(`('me' in owners)`);
  } else if (owner === OWNERSHIP_FILTERS.OTHERS) {
    query.push(`not ('me' in owners)`);
  }

  if (dateFilter !== DATE_FILTERS.ANYTIME) {
    const date = DATE_FILTERS_DESCRIPTION[dateFilter].date();
    query.push(`(modifiedTime > '${date}' or viewedByMeTime > '${date}')`);
  }

  const url = `https://www.googleapis.com/drive/v3/files?${qs.stringify({
    q: query.join(" and "),
    pageSize: configuration.nested.pageSize.get() ?? 5,
    fields:
      "nextPageToken, files(id, name, iconLink, modifiedTime, webViewLink, thumbnailLink, hasThumbnail, exportLinks)",
    pageToken: cursor,
  })}`;

  return makeGoogleRequest({ configuration, scope: DRIVE_SCOPE, url });
};

const googleDriveResultRenderer = ({ pages }) => {
  return _.flatten(
    pages.map(({ files }) => {
      return files?.map((file) => ({
        key: file.id,
        component: <DriveItemRender key={file.id} item={file} />,
        item: file,
      }));
    })
  );
};

export default function DriveSearchResults({ configuration, searchViewState }) {
  const searchData = searchViewState.get();
  const [fileType, setFileType] = React.useState(TYPE_FILTERS.ANY);
  const [owner, setOwner] = React.useState(OWNERSHIP_FILTERS.ANYONE);
  const [dateFilter, setDateFilter] = React.useState(DATE_FILTERS.ANYTIME);

  return (
    <PaginatedResults
      queryKey={[
        "drive" + hashConfiguration(configuration),
        { input: searchData.input, queryObj: searchData.queryObj, fileType, owner, dateFilter },
      ]}
      searchViewState={searchViewState}
      logo={logo}
      itemDetailRenderer={(item) => (
        <DriveDetailComponent item={item} configuration={configuration} />
      )}
      globalError={
        hasCorrectTokens(configuration.get()) === false ? (
          <div>
            Not authenticated. Go to the <Link to="/settings">settings</Link> to setup the Google
            Drive module.
          </div>
        ) : null
      }
      configuration={configuration}
      fetcher={makeGoogleDriveFetcher(configuration)}
      renderPages={googleDriveResultRenderer}
      getFetchMore={({ nextPageToken } = {}) => nextPageToken ?? null}
      filters={
        <>
          <Filter
            value={fileType}
            defaultId={TYPE_FILTERS.ANY}
            descriptions={TYPE_FILTER_DESCRIPTION}
            label="Type"
            setter={setFileType}
          />
          <OwnerFilter value={owner} setter={setOwner} />
          <DateFilter value={dateFilter} setter={setDateFilter} />
        </>
      }
      deps={[fileType, owner, dateFilter]}
    />
  );
}
