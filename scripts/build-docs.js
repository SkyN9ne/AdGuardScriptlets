// eslint-disable-next-line import/no-unresolved
const dox = require('dox');
const fs = require('fs');
const path = require('path');

const yaml = require('js-yaml');

const SCRIPTLETS_FILES_DIRECTORY = path.resolve(__dirname, '../src/scriptlets');
const REDIRECTS_FILES_DIRECTORY = path.resolve(__dirname, '../src/redirects');
const STATIC_REDIRECTS = path.resolve(__dirname, '../src/redirects/static-redirects.yml');

const DUPLICATES_LIST = path.resolve(__dirname, '../src/redirects/scriptlet-redirects.yml');

const ABOUT_SCRIPTLETS_PATH = path.resolve(__dirname, '../wiki/about-scriptlets.md');
const ABOUT_REDIRECTS_PATH = path.resolve(__dirname, '../wiki/about-redirects.md');

// List of redirects which have scriptlet duplicates
const duplicates = (() => {
    const duplicatesFile = fs.readFileSync(path.resolve(__dirname, DUPLICATES_LIST), { encoding: 'utf8' });
    const parsedDuplicatesFile = yaml.safeLoad(duplicatesFile);

    return parsedDuplicatesFile
        .reduce((acc, el) => {
            acc.push(`${el.title}`);
            return acc;
        }, []);
})();

/**
 * Gets list of files
 * @param {string} dirPath path to directory
 */
const getFilesList = (dirPath) => {
    const filesList = fs.readdirSync(dirPath, { encoding: 'utf8' })
        .filter((el) => el.includes('.js'));
    return filesList;
};

/**
 * Gets required comments from file.
 * In one file might be comments describing scriptlet and redirect as well.
 * @param {string} srcPath path to file
 */
const getComments = (srcPath) => {
    const srcCode = fs.readFileSync(srcPath, { encoding: 'utf8' });
    const parsedCommentsFromFile = dox.parseComments(srcCode);
    const describingComment = Object.values(parsedCommentsFromFile)
        .filter((comment) => {
            const [base] = comment.tags;
            const isNeededComment = (base
                && (base.type === 'scriptlet' || base.type === 'redirect'));
            return isNeededComment;
        });

    if (describingComment.length === 0) {
        throw new Error(`No description in ${srcPath}`);
    }

    return describingComment;
};

/**
 * Convert parsed comments to objects
 * @param {object} requiredComments parsed comments for one file
 * @param {string} sourcePath path to file
 */
const prepareData = (requiredComments, sourcePath) => {
    return requiredComments.map((el) => {
        const [base, sup] = el.tags;
        return {
            type: base.type,
            name: base.string,
            description: sup.string,
            source: sourcePath,
        };
    });
};

/**
 * Gets data objects which describe every required comment in one directory
 * @param {array} filesList list of files in directory
 * @param {string} directoryPath path to directory
 */
const getDataFromFiles = (filesList, directoryPath) => {
    return filesList.map((file) => {
        const sourcePath = `${directoryPath}/${file}`;
        const requiredComments = getComments(sourcePath);

        return prepareData(requiredComments, sourcePath);
    });
};

/**
 * Collects required comments from files and
 * returns describing object for scriptlets and redirects
 */
const manageDataFromFiles = () => {
    const scriptletsFilesList = getFilesList(SCRIPTLETS_FILES_DIRECTORY).filter((el) => !el.includes('index.js'));
    const redirectsFilesList = getFilesList(REDIRECTS_FILES_DIRECTORY).filter((el) => !el.includes('redirects.js'));

    // eslint-disable-next-line max-len
    const dataFromScriptletsFiles = getDataFromFiles(scriptletsFilesList, SCRIPTLETS_FILES_DIRECTORY);
    const dataFromRedirectsFiles = getDataFromFiles(redirectsFilesList, REDIRECTS_FILES_DIRECTORY);

    const fullData = dataFromScriptletsFiles.concat(dataFromRedirectsFiles).flat(Infinity);

    const scriptletsData = fullData.filter((el) => {
        return el.type === 'scriptlet';
    });
    const redirectsData = fullData.filter((el) => {
        return el.type === 'redirect';
    });

    return { scriptletsData, redirectsData };
};

/**
 * Generates markdown list and describing text
 * @param {object} data array of filtered objects - scriptlets or redirects
 */
const generateMD = (data) => {
    const output = data.reduce((acc, el) => {
        const mdListLink = duplicates.includes(el.name) ? `${el.name}-${el.type}` : el.name;
        acc.list.push(`* [${el.name}](#${mdListLink})\n`);

        const typeOfSrc = el.type === 'scriptlet' ? 'Scriptlet' : 'Redirect';

        const body = `### <a id="${mdListLink}"></a> ⚡️ ${el.name}
${el.description}
[${typeOfSrc} source](${el.source})
* * *\n\n`;
        acc.body.push(body);

        return acc;
    }, { list: [], body: [] });

    const list = output.list.join('');
    const body = output.body.join('');

    return { list, body };
};

/**
 * Generates markdown list and describing text for static redirect resources
 */
const mdForStaticRedirects = () => {
    const staticRedirects = fs.readFileSync(path.resolve(__dirname, STATIC_REDIRECTS), { encoding: 'utf8' });
    const parsedSR = yaml.safeLoad(staticRedirects);

    const output = parsedSR.reduce((acc, el) => {
        if (el.description) {
            acc.list.push(`* [${el.title}](#${el.title})\n`);

            const body = `### <a id="${el.title}"></a> ⚡️ ${el.title}
${el.description}
[Redirect source](./src/redirects/static-redirects.yml)
* * *\n\n`;
            acc.body.push(body);
        } else {
            throw new Error(`No description for ${el.title}`);
        }

        return acc;
    }, { list: [], body: [] });

    const list = output.list.join('');
    const body = output.body.join('');

    return { list, body };
};


/**
 * Entry function
 */
function init() {
    try {
        const scriptletsMarkdownData = generateMD(manageDataFromFiles().scriptletsData);
        const redirectsMarkdownData = generateMD(manageDataFromFiles().redirectsData);
        const staticRedirectsMarkdownData = mdForStaticRedirects();

        const scriptletsAbout = `## <a id="scriptlets"></a> Available Scriptlets\n${scriptletsMarkdownData.list}* * *\n${scriptletsMarkdownData.body}`;
        fs.writeFileSync(path.resolve(__dirname, ABOUT_SCRIPTLETS_PATH), scriptletsAbout);

        const redirectsAbout = `## <a id="redirect-resources"></a> Available Redirect resources\n${staticRedirectsMarkdownData.list}${redirectsMarkdownData.list}* * *\n${staticRedirectsMarkdownData.body}${redirectsMarkdownData.body}`;
        fs.writeFileSync(path.resolve(__dirname, ABOUT_REDIRECTS_PATH), redirectsAbout);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e.message);
    }
}

init();
